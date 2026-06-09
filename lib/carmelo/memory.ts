// Pure helpers that turn GP-CARS's past records into a compact "memory" block
// injected into Carmelo's context, so it learns from real outcomes instead of
// guessing. No DB / network here — fully unit-testable.

import type { MakeStats } from '@/lib/agents/analytics';

export type LearningRecord = {
  vehiculeResume?: string | null;
  make?: string | null;
  decision?: string | null;
  recommendedMaxBuy?: number | null;
  status?: string | null;
  realBuyPrice?: number | null;
  realSellPrice?: number | null;
  soldInDays?: number | null;
  analysisFeedback?: 'correct' | 'incorrect' | null;
  createdAt?: Date | string | null;
};

function euro(n: number | null | undefined): string {
  if (n == null) return '?';
  return `${n.toLocaleString('fr-BE')} €`;
}

// Score a record for relevance to the vehicle currently being analysed.
// Real sales (with margin reality) are the most valuable signal, followed by
// records of the same make as the new vehicle.
function scoreRecord(r: LearningRecord, haystack: string): number {
  let score = 0;
  if (r.status === 'vendu' && r.realSellPrice != null) score += 4;
  if (r.status === 'achete') score += 2;
  if (r.make && haystack.includes(r.make.toLowerCase())) score += 3;
  // Feedback boosts confirmed-correct analyses and flags incorrect ones.
  if (r.analysisFeedback === 'correct') score += 2;
  if (r.analysisFeedback === 'incorrect') score -= 1;
  return score;
}

export function selectRelevant(
  records: LearningRecord[],
  haystack: string,
  max = 8,
): LearningRecord[] {
  const lower = (haystack || '').toLowerCase();
  const scored = records
    .map((r) => ({ r, s: scoreRecord(r, lower) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  if (scored.length === 0) {
    // No strong match: fall back to the most recent real sales for calibration.
    return records
      .filter((r) => r.status === 'vendu' && r.realSellPrice != null)
      .slice(0, max);
  }
  return scored.slice(0, max).map((x) => x.r);
}

function formatRecord(r: LearningRecord): string {
  const label = r.vehiculeResume || r.make || 'Véhicule';
  const fb = r.analysisFeedback === 'correct' ? ' ✓' : r.analysisFeedback === 'incorrect' ? ' ✗ ANALYSE INCORRECTE' : '';
  if (r.status === 'vendu' && r.realSellPrice != null) {
    const days = r.soldInDays != null ? `${r.soldInDays} j` : 'délai inconnu';
    return `- VENDU · ${label} · acheté ${euro(r.realBuyPrice)} → vendu ${euro(r.realSellPrice)} en ${days}${fb}`;
  }
  if (r.status === 'achete') {
    return `- ACHETÉ · ${label} · prix d'achat ${euro(r.realBuyPrice)} (encore en stock)${fb}`;
  }
  return `- ANALYSÉ · ${label} · conseil achat max ${euro(r.recommendedMaxBuy)} · décision ${r.decision || '?'}${fb}`;
}

// Returns a compact summary of real GP-CARS performance by make.
// Only includes makes with at least 2 real sales to avoid noise.
export function buildStatsBlock(makeStats: MakeStats[]): string {
  const withData = makeStats.filter((m) => m.sold >= 2);
  if (withData.length === 0) return '';
  const lines = withData.map((m) => {
    const parts: string[] = [`${m.sold} vendu${m.sold > 1 ? 's' : ''}`];
    if (m.avgMargin != null) parts.push(`marge moy. ${euro(m.avgMargin)}`);
    if (m.avgDays != null) parts.push(`${m.avgDays}j en stock moy.`);
    parts.push(`taux de vente ${m.conversionRate}%`);
    return `- ${m.make} : ${parts.join(', ')}`;
  });
  return [
    '--- PERFORMANCES RÉELLES PAR MARQUE (GP-CARS) ---',
    ...lines,
    "Ajuste ton score de rotation et ta prudence en fonction de ces données réelles. Si une marque se vend lentement ou génère peu de marge, sois plus exigeant sur le prix d'achat.",
  ].join('\n');
}

// Returns '' when there's nothing useful to inject.
export function buildMemoryBlock(records: LearningRecord[]): string {
  if (!records || records.length === 0) return '';
  const lines = records.map(formatRecord).join('\n');
  return [
    '--- MÉMOIRE GP-CARS (achats/ventes réels — pour calibrer, ne jamais inventer) ---',
    lines,
    'Utilise ces cas réels pour ajuster ton prix et ton score de rotation. Si un véhicule similaire a mis longtemps à se vendre ou a généré une faible marge, sois plus prudent.',
  ].join('\n');
}
