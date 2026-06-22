import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from 'app/auth';
import {
  getMandatOpportunite, updateMandatOpportunite,
  createMandatRelances, publishEvent,
} from 'app/db';
import { buildMandatsSystemPrompt } from '@/lib/agents/mandats/system-prompt';
import { fetchListing } from '@/lib/carmelo/fetch-listing';
import type { ContactCanal } from '@/lib/agents/shared-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function extractJson(text: string): Record<string, unknown> | null {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch { return null; }
  }
  try { return JSON.parse(text.trim()); } catch { return null; }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée.' }, { status: 500 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body requis.' }, { status: 400 });

  let opportuniteId: number | null = body.opportuniteId ? Number(body.opportuniteId) : null;
  let userMessage = '';
  let opp = opportuniteId ? await getMandatOpportunite(opportuniteId, email) : null;

  if (opp) {
    const parts: string[] = ['# OPPORTUNITÉ À ANALYSER', ''];
    if (opp.listingUrl) parts.push(`URL annonce : ${opp.listingUrl}`);
    if (opp.make || opp.model) parts.push(`Véhicule : ${opp.make ?? ''} ${opp.model ?? ''} ${opp.year ?? ''} — ${opp.km ?? '?'} km — ${opp.askingPrice ? opp.askingPrice + ' €' : '?'}`);
    if (opp.location) parts.push(`Localisation : ${opp.location}`);
    if (opp.listingDescription) parts.push(`\nDescription annonce :\n${opp.listingDescription}`);
    if (opp.daysSincePosted) parts.push(`Ancienneté : ${opp.daysSincePosted} jours`);
    if ((opp.priceDropCount ?? 0) > 0) parts.push(`Baisses de prix : ${opp.priceDropCount}`);
    userMessage = parts.join('\n');
  } else if (body.url || body.description) {
    const parts: string[] = ['# ANNONCE À ANALYSER', ''];
    if (body.url) {
      parts.push(`URL : ${body.url}`);
      const listing = await fetchListing(body.url as string).catch(() => null);
      if (listing?.ok && listing.text) {
        parts.push(`\nContenu extrait :\n${listing.text.slice(0, 4000)}`);
      }
    }
    if (body.description) parts.push(`\nDescription fournie :\n${body.description}`);
    userMessage = parts.join('\n');
  } else {
    return NextResponse.json({ error: 'opportuniteId, url ou description requis.' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey, maxRetries: 2 });
  let rawText = '';

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: buildMandatsSystemPrompt(),
      messages: [{ role: 'user', content: userMessage }],
    });
    rawText = response.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('');
  } catch (err) {
    console.error('Mandats analyze error:', err);
    return NextResponse.json({ error: 'Erreur analyse Claude.' }, { status: 500 });
  }

  const parsed = extractJson(rawText);
  if (!parsed) {
    return NextResponse.json({ error: 'Réponse non parseable.', rawText: rawText.slice(0, 500) }, { status: 500 });
  }

  const scores = parsed.scores as Record<string, unknown>;
  const priorite = scores?.priorite as string;

  if (!opportuniteId) {
    const vehicule = parsed.vehicule as Record<string, unknown>;
    const vendeur = parsed.vendeur as Record<string, unknown>;
    const { createMandatOpportunite: create } = await import('app/db');
    opp = await create(email, {
      source:       (body.source as string) ?? 'manuel',
      listingUrl:   (body.url as string) ?? null,
      make:         (vehicule?.marque as string) ?? null,
      model:        (vehicule?.modele as string) ?? null,
      version:      (vehicule?.version as string) ?? null,
      year:         (vehicule?.annee as number) ?? null,
      km:           (vehicule?.km as number) ?? null,
      fuel:         (vehicule?.carburant as string) ?? null,
      gearbox:      (vehicule?.boite as string) ?? null,
      askingPrice:  (vehicule?.prix_affiche as number) ?? null,
      location:     (vehicule?.localisation as string) ?? null,
      sellerType:   (vendeur?.type as string) ?? null,
      annonceQuality: (vendeur?.qualite_annonce as number) ?? null,
      photosQuality:  (vendeur?.qualite_photos as number) ?? null,
      daysSincePosted: (vendeur?.anciennete_jours as number) ?? null,
      priceDropCount:  (vendeur?.baisses_prix as number) ?? 0,
      proDeguise:   (vendeur?.professionnel_deguise as boolean) ?? false,
    });
    opportuniteId = opp!.id;
  }

  const relancesAI = (parsed.relances as Array<Record<string, unknown>>) ?? [];
  const now = Date.now();
  const relancesDB = relancesAI.map((r) => {
    let days = 2;
    if (r.declencheur === 'j+7') days = 7;
    else if (r.declencheur === 'j+14') days = 14;
    return {
      canal:        (r.canal as ContactCanal) ?? 'whatsapp',
      messagePrevu: (r.message as string) ?? '',
      scheduledAt:  new Date(now + days * 86400000),
      triggerType:  (r.declencheur as string) ?? 'j+2',
    };
  });
  if (relancesDB.length > 0) {
    await createMandatRelances(opportuniteId, email, relancesDB);
  }

  const estimation = parsed.estimation as Record<string, unknown>;
  const vendeur = parsed.vendeur as Record<string, unknown>;
  const urgence = parsed.urgence as Record<string, unknown>;

  await updateMandatOpportunite(opportuniteId, email, {
    scoreMandat:         (scores?.mandat as number)         ?? null,
    scoreSignature:      (scores?.signature as number)      ?? null,
    scoreRentabilite:    (scores?.rentabilite as number)    ?? null,
    priorite:            priorite as 'A' | 'B' | 'C' | 'rejet' ?? null,
    urgenceNiveau:       (urgence?.niveau as 'faible' | 'moyenne' | 'forte' | 'tres_forte') ?? null,
    urgenceSignaux:      (urgence?.signaux as string[])     ?? [],
    prixRapide:          (estimation?.prix_rapide as number)   ?? null,
    prixMarche:          (estimation?.prix_marche as number)   ?? null,
    prixOptimise:        (estimation?.prix_optimise as number) ?? null,
    delaiVente:          (estimation?.delai_vente_jours as number) ?? null,
    commissionBrute:     (estimation?.commission_brute as number)  ?? null,
    commissionNette:     (estimation?.commission_nette as number)  ?? null,
    rentabilite:         (estimation?.rentabilite as 'faible' | 'correcte' | 'bonne' | 'excellente') ?? null,
    analyse:             (parsed.analyse as string)         ?? null,
    forces:              (parsed.forces as string[])        ?? [],
    faiblesses:          (parsed.faiblesses as string[])    ?? [],
    risques:             (parsed.risques as string[])       ?? [],
    scriptSms:           ((parsed.scripts as Record<string, unknown>)?.sms as string)       ?? null,
    scriptWhatsapp:      ((parsed.scripts as Record<string, unknown>)?.whatsapp as string)  ?? null,
    scriptEmail:         ((parsed.scripts as Record<string, unknown>)?.email as string)     ?? null,
    scriptMessenger:     ((parsed.scripts as Record<string, unknown>)?.messenger as string) ?? null,
    scriptTelephone:     ((parsed.scripts as Record<string, unknown>)?.telephone as Record<string, string>) ?? null,
    objections:          (parsed.objections as Array<{objection:string;reponse:string;strategie:string}>) ?? [],
    relancesProgrammees: (parsed.relances as Array<{declencheur:string;canal:string;message:string}>) ?? [],
    nextSteps:           (parsed.nextSteps as string[])     ?? [],
    proDeguise:          (vendeur?.professionnel_deguise as boolean) ?? false,
    rawAnalysis:         rawText,
    confidenceLevel:     (parsed.confidenceLevel as number) ?? null,
  });

  if (priorite === 'A') {
    await publishEvent('mandats.priorite_a', 'mandats', { opportuniteId }, email);
  }

  return NextResponse.json({ ok: true, opportuniteId, result: parsed });
}
