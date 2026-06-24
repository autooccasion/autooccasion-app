import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from 'app/auth';
import {
  getGarantieDossier, updateGarantieDossier,
  saveGarantiePieces, publishEvent,
} from 'app/db';
import { buildGarantieSystemPrompt } from '@/lib/agents/garantie/system-prompt';
import { ACTIVE_RULESET } from '@/lib/agents/garantie/ruleset';
import type { GarantieCoverage, GarantieStatus } from '@/lib/agents/shared-types';

export const maxDuration = 60;

function extractJson(text: string): Record<string, unknown> | null {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

function buildDossierMessage(dossier: Awaited<ReturnType<typeof getGarantieDossier>>): string {
  if (!dossier) return '';

  const lines: string[] = ['# DOSSIER DE GARANTIE À ANALYSER', ''];

  lines.push('## VÉHICULE');
  lines.push(`Marque/Modèle : ${dossier.vehicleMake ?? '?'} ${dossier.vehicleModel ?? '?'} ${dossier.vehicleYear ?? ''}`);
  if (dossier.vehicleVin) lines.push(`VIN : ${dossier.vehicleVin}`);
  if (dossier.vehicleKmAtSale) lines.push(`Km à la vente : ${dossier.vehicleKmAtSale.toLocaleString('fr-BE')} km`);
  if (dossier.vehicleKmNow) lines.push(`Km actuels : ${dossier.vehicleKmNow.toLocaleString('fr-BE')} km`);
  if (dossier.vehicleKmAtSale && dossier.vehicleKmNow) {
    lines.push(`Km parcourus depuis vente : ${(dossier.vehicleKmNow - dossier.vehicleKmAtSale).toLocaleString('fr-BE')} km`);
  }

  lines.push('');
  lines.push('## VENTE');
  if (dossier.saleDate) lines.push(`Date de vente : ${new Date(dossier.saleDate).toLocaleDateString('fr-BE')}`);
  if (dossier.invoiceNumber) lines.push(`N° facture : ${dossier.invoiceNumber}`);
  lines.push(`Durée de garantie contractuelle : ${dossier.warrantyDurationMonths ?? 12} mois`);

  if (dossier.saleDate) {
    const monthsSinceSale = Math.floor((Date.now() - new Date(dossier.saleDate).getTime()) / (30 * 24 * 60 * 60 * 1000));
    lines.push(`Délai depuis la vente : ${monthsSinceSale} mois`);
    lines.push(`Période de présomption (6 mois) : ${monthsSinceSale <= 6 ? 'ACTIVE — le défaut est présumé exister à la vente' : 'EXPIRÉE — charge de la preuve sur le client'}`);
    const warrantyMonths = dossier.warrantyDurationMonths ?? 12;
    lines.push(`Garantie contractuelle : ${monthsSinceSale <= warrantyMonths ? `ACTIVE (${warrantyMonths - monthsSinceSale} mois restants)` : 'EXPIRÉE'}`);
  }

  lines.push('');
  lines.push('## RÉCLAMATION CLIENT');
  lines.push(`Client : ${dossier.customerName ?? '?'}`);
  if (dossier.claimDate) lines.push(`Date réclamation : ${new Date(dossier.claimDate).toLocaleDateString('fr-BE')}`);
  if (dossier.claimDescription) lines.push(`Description : ${dossier.claimDescription}`);
  if (dossier.symptoms) lines.push(`Symptômes : ${dossier.symptoms}`);
  if (dossier.repairsAlreadyDone) lines.push(`Réparations déjà effectuées : ${dossier.repairsAlreadyDone}`);

  lines.push('');
  lines.push('## UTILISATION & ENTRETIEN');
  if (dossier.usageType) lines.push(`Type d'utilisation : ${dossier.usageType}`);
  if (dossier.maintenanceOk != null) lines.push(`Entretien conforme : ${dossier.maintenanceOk ? 'Oui' : 'Non / Non documenté'}`);

  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const body = await req.json().catch(() => null);
  if (!body?.dossierId || typeof body.dossierId !== 'number') {
    return NextResponse.json({ error: 'dossierId requis.' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée.' }, { status: 500 });

  const dossier = await getGarantieDossier(body.dossierId, email);
  if (!dossier) return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 });

  // Auto-recover dossiers stuck in en_analyse for more than 5 minutes
  if (dossier.status === 'en_analyse') {
    const stuckSince = dossier.updatedAt ? new Date(dossier.updatedAt).getTime() : 0;
    if (Date.now() - stuckSince < 5 * 60 * 1000) {
      return NextResponse.json({ error: 'Analyse déjà en cours. Réessayez dans 5 minutes.' }, { status: 409 });
    }
    // Been stuck > 5 min — allow retry
  }

  await updateGarantieDossier(body.dossierId, email, { status: 'en_analyse' as GarantieStatus });

  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const userMessage = buildDossierMessage(dossier);

  let rawText = '';
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      system: buildGarantieSystemPrompt(ACTIVE_RULESET),
      messages: [{ role: 'user', content: userMessage }],
    });
    rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');
  } catch (err) {
    await updateGarantieDossier(body.dossierId, email, { status: 'nouveau' as GarantieStatus });
    console.error('Garantie analyze error:', err);
    return NextResponse.json({ error: 'Erreur lors de l\'analyse Claude.' }, { status: 500 });
  }

  const parsed = extractJson(rawText);
  if (!parsed) {
    await updateGarantieDossier(body.dossierId, email, { status: 'nouveau' as GarantieStatus });
    return NextResponse.json({ error: 'Réponse Claude non parseable.', rawText }, { status: 500 });
  }

  // Save pieces vetustness
  if (Array.isArray(parsed.pieces) && parsed.pieces.length > 0) {
    await saveGarantiePieces(body.dossierId, email, parsed.pieces as Parameters<typeof saveGarantiePieces>[2]);
  }

  // Determine new status
  const litigationProbability = (parsed.litigationProbability as number) ?? 0;
  const newStatus: GarantieStatus = litigationProbability > 70 ? 'litige' : 'decision_prise';

  // Persist all AI results
  await updateGarantieDossier(body.dossierId, email, {
    status:                   newStatus,
    category:                 parsed.category as any,
    coverageDecision:         (parsed.coverageDecision as GarantieCoverage) ?? 'en_attente',
    coveragePercent:          (parsed.coveragePercent as number)    ?? null,
    clientContribution:       (parsed.clientContribution as number) ?? null,
    riskScoreLegal:           (parsed.riskScoreLegal as number)     ?? null,
    riskScoreFinancial:       (parsed.riskScoreFinancial as number) ?? null,
    litigationProbability:    (parsed.litigationProbability as number) ?? null,
    garageSuccessProbability: (parsed.garageSuccessProbability as number) ?? null,
    confidenceLevel:          (parsed.confidenceLevel as number)    ?? null,
    aiAnalysis:               (parsed.analysis as string)           ?? null,
    aiRecommendation:         (parsed.recommendation as string)     ?? null,
    aiStrengths:              (parsed.strengths as string[])        ?? null,
    aiWeaknesses:             (parsed.weaknesses as string[])       ?? null,
    aiLegalBasis:             (parsed.legalBasis as string[])       ?? null,
    aiNextSteps:              (parsed.nextSteps as string[])        ?? null,
    communicationEmail:       (parsed.communicationEmail as string) ?? null,
    communicationWhatsapp:    (parsed.communicationWhatsapp as string) ?? null,
    communicationRefus:       (parsed.communicationRefus as string) ?? null,
    communicationTransaction: (parsed.communicationTransaction as string) ?? null,
    litigationPackage:        (parsed.litigationPackage as Record<string, unknown>) ?? null,
  });

  await publishEvent('garantie.decision', 'garantie', {
    dossierId: body.dossierId,
    category: parsed.category,
    coverageDecision: parsed.coverageDecision,
    litigationProbability,
  }, email);

  if (newStatus === 'litige') {
    await publishEvent('garantie.litige_detecte', 'garantie', { dossierId: body.dossierId }, email);
  }

  return NextResponse.json({ ok: true, result: parsed });
}
