// Non-streaming Carmelo analysis — used by the scanner batch job.
// Same logic as app/api/carmelo/analyze/route.ts but returns a structured
// result instead of a streaming response.

import Anthropic from '@anthropic-ai/sdk';
import { buildCarmeloSystemPrompt } from './system-prompt';
import { fetchListing } from './fetch-listing';
import { selectRelevant, buildMemoryBlock, buildStatsBlock } from './memory';
import { parseReport } from './parse';
import { saveAnalysis, getAnalyses, createVehicle, saveControllerResult, getVehicleSummaries } from 'app/db';
import { computeMakeStats } from '@/lib/agents/analytics';
import { runHardRules } from '@/lib/agents/controller/system-prompt';
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

  // 2. Memory & stats context.
  let memoryBlock = '';
  let statsBlock = '';
  try {
    const [past, summaries] = await Promise.all([
      getAnalyses(email, 40),
      getVehicleSummaries(email),
    ]);
    memoryBlock = buildMemoryBlock(selectRelevant(past, listing.text));
    statsBlock = buildStatsBlock(computeMakeStats(summaries));
  } catch {}

  const parts: string[] = [
    `LIEN DE L'ANNONCE : ${url}`,
    `ANNONCE EXTRAITE DU LIEN (à vérifier contre les critères) :\n${listing.text}`,
  ];
  if (statsBlock) parts.push(statsBlock);
  if (memoryBlock) parts.push(memoryBlock);

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
