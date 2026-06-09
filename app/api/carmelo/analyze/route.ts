import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildCarmeloSystemPrompt } from '@/lib/carmelo/system-prompt';
import { fetchListing } from '@/lib/carmelo/fetch-listing';
import { selectRelevant, buildMemoryBlock, buildStatsBlock } from '@/lib/carmelo/memory';
import { parseReport } from '@/lib/carmelo/parse';
import { auth } from 'app/auth';
import { cookies } from 'next/headers';
import { saveAnalysis, getVehiclesForMemory, createVehicle, saveControllerResult, getVehicleSummaries } from 'app/db';
import { computeMakeStats } from '@/lib/agents/analytics';
import { runHardRules } from '@/lib/agents/controller/system-prompt';
import type { VehicleSummary } from '@/lib/agents/shared-types';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  const email = session.user.email;

  // 10 analyses par minute par utilisateur
  const rl = checkRateLimit(`analyze:${email}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de requêtes. Attendez une minute avant de réessayer.' },
      { status: 429 },
    );
  }

  const apiKey =
    process.env.ANTHROPIC_API_KEY ||
    cookies().get('gp_api_key')?.value;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Clé API Anthropic non configurée. Rendez-vous sur /settings pour l'ajouter." },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null);
  const vehicule = typeof body?.vehicule === 'string' ? body.vehicule.trim() : '';
  const url = typeof body?.url === 'string' ? body.url.trim() : '';

  if (!vehicule && !url) {
    return NextResponse.json(
      { error: "Fournissez une description ou un lien d'annonce." },
      { status: 400 },
    );
  }

  // 1. Lire l'annonce depuis le lien.
  let listingText = '';
  let listingNote = '';
  if (url) {
    const listing = await fetchListing(url);
    if (listing.ok && listing.text) {
      listingText = listing.text;
    } else {
      listingNote = listing.error || 'Lien illisible.';
    }
  }

  if (!vehicule && !listingText) {
    return NextResponse.json(
      { error: `Impossible de lire le lien : ${listingNote} Collez le texte de l'annonce.` },
      { status: 422 },
    );
  }

  // 2. Mémoire GP-CARS — cas passés pertinents + statistiques par marque.
  let memoryBlock = '';
  let statsBlock = '';
  try {
    const haystack = `${listingText} ${vehicule}`;
    const [past, summaries] = await Promise.all([
      getVehiclesForMemory(email, 40),
      getVehicleSummaries(email),
    ]);
    const relevant = selectRelevant(past, haystack);
    memoryBlock = buildMemoryBlock(relevant);
    const makeStats = computeMakeStats(summaries);
    statsBlock = buildStatsBlock(makeStats);
  } catch (err) {
    console.error('Carmelo: mémoire indisponible', err);
  }

  // 3. Message utilisateur.
  const parts: string[] = [];
  if (url) parts.push(`LIEN DE L'ANNONCE : ${url}`);
  if (listingText) {
    parts.push(`ANNONCE EXTRAITE DU LIEN (à vérifier contre les critères) :\n${listingText}`);
  } else if (listingNote) {
    parts.push(`(Lien non lisible automatiquement : ${listingNote})`);
  }
  if (vehicule) parts.push(`DESCRIPTION FOURNIE :\n${vehicule}`);
  if (statsBlock) parts.push(statsBlock);
  if (memoryBlock) parts.push(memoryBlock);
  const userMessage = parts.join('\n\n');

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let full = '';
      try {
        const messageStream = client.messages.stream({
          model: 'claude-opus-4-8',
          max_tokens: 2048,
          system: buildCarmeloSystemPrompt(),
          messages: [{ role: 'user', content: userMessage }],
        });

        for await (const event of messageStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        // Persist + auto-contrôleur (best-effort — ne jamais couper le stream).
        if (full.trim().length > 0) {
          try {
            // saveAnalysis retourne maintenant les lignes via .returning()
            const analysisRows = await saveAnalysis(email, vehicule, full, url || null);
            const analysisId = analysisRows[0]?.id ?? null;

            const parsed = parseReport(full);
            const vehicleRows = await createVehicle(email, {
              make: parsed.make,
              model: parsed.model,
              year: parsed.year,
              km: parsed.km,
              fuel: parsed.fuel,
              gearbox: parsed.gearbox,
              listingUrl: url || null,
              askingPrice: null,
              marketPrice: parsed.marketPrice,
              maxBuyPrice: parsed.recommendedMaxBuy,
              estimatedMargin: parsed.estimatedMargin,
              rotationScore: parsed.rotationScore,
              confidence: parsed.confidence,
              decision: parsed.decision,
              analysisReport: full,
              analysisId,
            });

            // Contrôleur automatique — règles dures uniquement, sans LLM.
            const newVehicle = vehicleRows[0];
            if (newVehicle) {
              const summary: VehicleSummary = {
                id: newVehicle.id,
                make: newVehicle.make ?? null,
                model: newVehicle.model ?? null,
                year: newVehicle.year ?? null,
                km: newVehicle.km ?? null,
                fuel: newVehicle.fuel ?? null,
                status: (newVehicle.status ?? 'analyse') as VehicleSummary['status'],
                askingPrice: newVehicle.askingPrice ?? null,
                maxBuyPrice: newVehicle.maxBuyPrice ?? null,
                realBuyPrice: newVehicle.realBuyPrice ?? null,
                realSellPrice: newVehicle.realSellPrice ?? null,
                decision: (newVehicle.decision ?? 'INCONNU') as VehicleSummary['decision'],
                soldInDays: newVehicle.soldInDays ?? null,
                realMargin: newVehicle.realMargin ?? null,
                publishedAt: newVehicle.publishedAt ?? null,
                soldAt: newVehicle.soldAt ?? null,
              };
              const flags = runHardRules(summary);
              const hasBlocker = flags.some((f) => f.severity === 'bloquant');
              await saveControllerResult(newVehicle.id, email, {
                validated: !hasBlocker,
                requiresHuman: (parsed.confidence ?? 100) < 85 || hasBlocker,
                flags,
                notes: hasBlocker ? 'Bloqué par règles dures — validation manuelle requise.' : '',
              });
            }
          } catch (err) {
            console.error('Carmelo: échec sauvegarde', err);
          }
        }

        controller.close();
      } catch (err) {
        console.error('Carmelo: erreur analyse', err);
        if (full.length === 0) {
          controller.enqueue(
            encoder.encode("⚠️ Erreur lors de l'analyse. Vérifiez la clé API et réessayez."),
          );
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
