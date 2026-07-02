// Market-intelligence engine for Carmelo. Pure functions (no DB / network),
// so they are fully unit-testable and can be fed by ANY data source later
// (manual import, official API, or a data provider).
//
// Two jobs:
//  1. Turn a set of comparable market prices into robust statistics.
//  2. Position a price like AutoScout's rating ("bonne affaire" …) AND derive
//     the GP-CARS max buy price that lands OUR resale in the "bonne affaire"
//     band while preserving margin.

import { DEFAULT_GARAGE_CONFIG, plancherFrais, type GarageConfig } from './garage-config';

// Target our resale just under the market median → competitive, fast rotation,
// and labelled a good deal by the platforms' algorithms.
export const SELL_POSITION_FACTOR = 0.96;

// Conservative reconditioning provision used at screening time, when the real
// condition isn't known yet (on top of the incompressible floor).
export const SCREENING_PROVISION = 600;

export type MarketStats = {
  sample: number;
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

// Returns null when there aren't enough comparables to trust the statistics.
export function computeStats(prices: number[], minSample = 3): MarketStats | null {
  const clean = prices
    .filter((p) => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);
  if (clean.length < minSample) return null;
  return {
    sample: clean.length,
    median: percentile(clean, 0.5),
    p25: percentile(clean, 0.25),
    p75: percentile(clean, 0.75),
    min: clean[0],
    max: clean[clean.length - 1],
  };
}

export type Positioning =
  | 'tres_bonne_affaire'
  | 'bonne_affaire'
  | 'correct'
  | 'eleve'
  | 'tres_eleve';

export const POSITIONING_LABELS: Record<Positioning, string> = {
  tres_bonne_affaire: 'Très bonne affaire',
  bonne_affaire: 'Bonne affaire',
  correct: 'Prix correct',
  eleve: 'Prix élevé',
  tres_eleve: 'Prix très élevé',
};

// Rate a price against the market median, mirroring the platforms' label.
export function positionPrice(price: number, stats: MarketStats): Positioning {
  const ratio = price / stats.median;
  if (ratio <= 0.9) return 'tres_bonne_affaire';
  if (ratio <= 0.97) return 'bonne_affaire';
  if (ratio <= 1.03) return 'correct';
  if (ratio <= 1.1) return 'eleve';
  return 'tres_eleve';
}

export type OpportunityZone = 'vert' | 'orange' | 'rouge';

export type Opportunity = {
  stats: MarketStats;
  targetSell: number;        // our resale price, positioned as a good deal
  targetPositioning: Positioning;
  tier: 'standard' | 'premium';
  marginTarget: number;
  costs: number;             // screening cost floor
  cushion: number;           // client negotiation cushion
  maxBuy: number;            // max we should pay
  askingPrice: number;
  askingPositioning: Positioning;
  marginAtAsk: number;       // margin if we bought at the asking price
  zone: OpportunityZone;
  isGoodDeal: boolean;
  exceedsCeiling: boolean;   // asking price above GP-CARS purchase ceiling
};

export function evaluateOpportunity(
  askingPrice: number,
  stats: MarketStats,
  config: GarageConfig = DEFAULT_GARAGE_CONFIG,
): Opportunity {
  const MARGES = config.margins;
  const GP_CARS_PARAMS = config.params;
  const targetSell = Math.round(stats.median * SELL_POSITION_FACTOR);
  const tier: 'standard' | 'premium' = targetSell >= 20000 ? 'premium' : 'standard';
  const marginTarget = MARGES[tier].cible;
  const cushion = Math.round(
    (targetSell * GP_CARS_PARAMS.coussin_negociation_client_pct) / 100,
  );
  const costs = plancherFrais(config) + SCREENING_PROVISION;

  const maxBuy = targetSell - marginTarget - costs - cushion;
  const marginAtAsk = targetSell - askingPrice - costs - cushion;

  let zone: OpportunityZone;
  if (marginAtAsk >= marginTarget) zone = 'vert';
  else if (marginAtAsk >= MARGES[tier].orange_min) zone = 'orange';
  else zone = 'rouge';

  const ceiling = GP_CARS_PARAMS.plafond_achat_vehicule;
  const exceedsCeiling = askingPrice > ceiling;

  return {
    stats,
    targetSell,
    targetPositioning: positionPrice(targetSell, stats),
    tier,
    marginTarget,
    costs,
    cushion,
    maxBuy,
    askingPrice,
    askingPositioning: positionPrice(askingPrice, stats),
    marginAtAsk,
    zone,
    isGoodDeal: zone !== 'rouge' && askingPrice <= maxBuy && !exceedsCeiling,
    exceedsCeiling,
  };
}
