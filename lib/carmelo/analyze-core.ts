// Non-streaming Carmelo analysis — used by the scanner batch job.
// Same logic as app/api/carmelo/analyze/route.ts but returns a structured
// result instead of a streaming response.

import Anthropic from '@anthropic-ai/sdk';
import { buildCarmeloSystemPrompt } from './system-prompt';
import { fetchListing } from './fetch-listing';
import { selectRelevant, buildMemoryBlock, buildStatsBlock } from './memory';
import { parseReport } from './parse';
import { saveAnalysis, getVehiclesForMemory, createVehicle, saveControllerResult, getVehicleSummaries, buildDemandBlock, recordPricePoint, getLastKnownPrice } from 'app/db';
import { computeMakeStats } from '@/lib/agents/analytics';
import { runHardRules } from '@/lib/agents/controller/system-prompt';
import { emit } from '@/lib/events/publish';
import type { VehicleSummary } from '@/lib/agents/shared-types';

export type AnalysisCoreResult =
  | {
      ok: true;
      vehicleId: number;
      decision: string;
      make: string | null;
      maxBuyPrice: number | null;
      estimatedMargin: number | null;
      confidence: number | null;
      rotationScore: number | null;
    }
  | { ok: false; error: string };

export async function runCarmeloAnalysis(
  email: string,
  url: string,
  apiKey: string,
): Promise<AnalysisCoreResult> {
  // 1. Fetch the listing content.
  const listing = await fetchListing(url);
  if (!listing.ok || !listing.text) {
    return { ok: false, error: listing.error || 'Impossible de lire le lien.' };
  }

  // 2. Memory, stats & demand context.
  let memoryBlock = '';
  let statsBlock = '';
  let demandBlock = '';
  let priceDropNote = '';
  try {
    const [past, summaries, demand, lastPrice] = await Promise.all([
      getVehiclesForMemory(email, 40),
      getVehicleSummaries(email),
      buildDemandBlock(),
      getLastKnownPrice(email, url),
    ]);
    memoryBlock = buildMemoryBlock(selectRelevant(past, listing.text));
    statsBlock = buildStatsBlock(computeMakeStats(summaries));
    demandBlock = demand;

    // Detect price drop since last analysis of this URL
    if (lastPrice && listing.text) {
      const priceMatch = listing.text.match(/(\d[\s\d]*)\s*€/);
      if (priceMatch) {
        const currentPrice = Number(priceMatch[1].replace(/\s/g, ''));
        if (currentPrice > 0 && currentPrice < lastPrice) {
          const drop = lastPrice - currentPrice;
          priceDropNote = `⚠️ HISTORIQUE PRIX : Ce véhicule était affiché à ${lastPrice.toLocaleString('fr-BE')} €. Prix actuel : ${currentPrice.toLocaleString('fr-BE')} €. Baisse de ${drop.toLocaleString('fr-BE')} € — le vendeur est peut-être plus motivé à négocier.`;
        }
      }
    }
  } catch {}

  const parts: string[] = [
    `LIEN DE L'ANNONCE : ${url}`,
    `ANNONCE EXTRAITE DU LIEN (à vérifier contre les critères) :\n${listing.text}`,
  ];
  if (priceDropNote) parts.push(priceDropNote);
  if (statsBlock) parts.push(statsBlock);
  if (memoryBlock) parts.push(memoryBlock);
  if (demandBlock) parts.push(demandBlock);

  // 3. Claude call — non-streaming for batch use.
  const client = new Anthropic({ apiKey });
  let full: string;
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      system: buildCarmeloSystemPrompt(),
      messages: [{ role: 'user', content: parts.join('\n\n') }],
    });
    full = response.content[0]?.type === 'text' ? response.content[0].text : '';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur API Anthropic.';
    return { ok: false, error: msg };
  }

  if (!full.trim()) return { ok: false, error: 'Réponse vide de Claude.' };

  // 4. Persist analysis + vehicle + auto-controller.
  try {
    const analysisRows = await saveAnalysis(email, '', full, url);
    const analysisId = analysisRows[0]?.id ?? null;
    const parsed = parseReport(full);

    const vehicleRows = await createVehicle(email, {
      make: parsed.make,
      model: parsed.model,
      year: parsed.year,
      km: parsed.km,
      fuel: parsed.fuel,
      gearbox: parsed.gearbox,
      listingUrl: url,
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

    const newVehicle = vehicleRows[0];
    if (!newVehicle) return { ok: false, error: 'Véhicule non sauvegardé.' };

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
      estimatedMargin: newVehicle.estimatedMargin ?? null,
      confidence: newVehicle.confidence ?? null,
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

    // Record price history for this listing URL
    if (listing.text) {
      const priceMatch = listing.text.match(/(\d[\s\d]*)\s*€/);
      if (priceMatch) {
        const price = Number(priceMatch[1].replace(/\s/g, ''));
        if (price > 0) {
          const label = [parsed.make, parsed.model, parsed.year].filter(Boolean).join(' ');
          await recordPricePoint(email, url, price, label || undefined).catch(() => {});
        }
      }
    }

    // Fire immediate events for positive decisions
    const vehicleLabel = [parsed.make, parsed.model, parsed.year].filter(Boolean).join(' ') || 'Véhicule';
    if (parsed.decision === 'OR' && !hasBlocker) {
      await emit('opportunite.or', 'carmelo', {
        vehicleId: newVehicle.id,
        vehicleLabel,
        maxBuyPrice: parsed.recommendedMaxBuy ?? 0,
        estimatedMargin: parsed.estimatedMargin ?? 0,
        confidence: parsed.confidence ?? 0,
        listingUrl: url,
      }).catch(() => {});
    } else if (parsed.decision === 'VERT' && !hasBlocker) {
      await emit('opportunite.vert', 'carmelo', {
        vehicleId: newVehicle.id,
        vehicleLabel,
        maxBuyPrice: parsed.recommendedMaxBuy ?? 0,
        estimatedMargin: parsed.estimatedMargin ?? 0,
        listingUrl: url,
      }).catch(() => {});
    }

    return {
      ok: true,
      vehicleId: newVehicle.id,
      decision: parsed.decision,
      make: parsed.make,
      maxBuyPrice: parsed.recommendedMaxBuy,
      estimatedMargin: parsed.estimatedMargin,
      confidence: parsed.confidence,
      rotationScore: parsed.rotationScore,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur de sauvegarde.';
    return { ok: false, error: msg };
  }
}
