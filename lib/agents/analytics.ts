// Pure analytics functions over the Vehicle dataset.
// All inputs are plain arrays — no DB / network dependencies.

import type { VehicleSummary, ControllerFlag } from './shared-types';

export type MakeStats = {
  make: string;
  count: number;
  sold: number;
  avgMargin: number | null;
  avgDays: number | null;
  conversionRate: number; // sold / purchased
};

export type StockHealth = {
  total: number;
  inStock: number;         // achete + en_stock + publie
  published: number;
  sold: number;
  refused: number;
  avgDaysInStock: number | null;
  slowVehicles: VehicleSummary[]; // published > 60 days without selling
  totalStockValue: number; // sum of real buy prices in stock
};

export type PerformanceKPIs = {
  soldLast30: number;
  soldLast7: number;
  avgMarginLast30: number | null;
  avgRotationLast30: number | null;
  bestMake: string | null;
  worstMake: string | null;
  weeklyBuyTarget: number; // how many to buy to maintain stock level
};

function avg(nums: number[]): number | null {
  const valid = nums.filter((n) => Number.isFinite(n));
  if (!valid.length) return null;
  return Math.round(valid.reduce((s, n) => s + n, 0) / valid.length);
}

function daysSince(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const ms = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function computeMakeStats(vehicles: VehicleSummary[]): MakeStats[] {
  const byMake = new Map<string, VehicleSummary[]>();
  for (const v of vehicles) {
    const key = v.make || 'Inconnue';
    if (!byMake.has(key)) byMake.set(key, []);
    byMake.get(key)!.push(v);
  }
  return Array.from(byMake.entries())
    .map(([make, list]) => {
      const purchased = list.filter((v) => ['achete','en_stock','publie','vendu'].includes(v.status));
      const sold = list.filter((v) => v.status === 'vendu');
      return {
        make,
        count: purchased.length,
        sold: sold.length,
        avgMargin: avg(sold.map((v) => v.realMargin).filter((m): m is number => m != null)),
        avgDays: avg(sold.map((v) => v.soldInDays).filter((d): d is number => d != null)),
        conversionRate: purchased.length > 0 ? Math.round((sold.length / purchased.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function computeStockHealth(
  vehicles: VehicleSummary[],
  slowThresholdDays = 60,
): StockHealth {
  const inStock = vehicles.filter((v) => ['achete','en_stock','publie'].includes(v.status));
  const published = vehicles.filter((v) => v.status === 'publie');
  const sold = vehicles.filter((v) => v.status === 'vendu');
  const refused = vehicles.filter((v) => v.status === 'refuse');

  const slowVehicles = published.filter((v) => {
    const days = daysSince(v.publishedAt);
    return days != null && days > slowThresholdDays;
  });

  const totalStockValue = inStock.reduce((s, v) => s + (v.realBuyPrice || 0), 0);

  return {
    total: vehicles.length,
    inStock: inStock.length,
    published: published.length,
    sold: sold.length,
    refused: refused.length,
    avgDaysInStock: avg(sold.map((v) => v.soldInDays).filter((d): d is number => d != null)),
    slowVehicles,
    totalStockValue,
  };
}

// --- Surstock & Budget helpers ---

export type SurstockRisk = {
  make: string;
  countInStock: number;
  threshold: number;
  isRisky: boolean;
  message: string;
};

export function computeSurstockRisk(
  vehicles: VehicleSummary[],
  targetMake: string | null,
  threshold = 2,
): SurstockRisk | null {
  if (!targetMake) return null;
  const inStock = vehicles.filter(
    (v) =>
      v.make?.toLowerCase() === targetMake.toLowerCase() &&
      ['achete', 'en_stock', 'publie'].includes(v.status),
  );
  const isRisky = inStock.length >= threshold;
  return {
    make: targetMake,
    countInStock: inStock.length,
    threshold,
    isRisky,
    message: isRisky
      ? `${inStock.length} ${targetMake} déjà en stock (seuil : ${threshold}) — risque de surstock.`
      : `${inStock.length} ${targetMake} en stock — pas de surstock.`,
  };
}

export type BudgetStatus = {
  capitalEngage: number;
  budgetJournalier: number;
  budgetRestant: number;
  isConstrained: boolean;
  isExhausted: boolean;
};

export function computeBudgetDisponible(
  vehicles: VehicleSummary[],
  budgetJournalier: number,
): BudgetStatus {
  const capitalEngage = vehicles
    .filter((v) => ['achete', 'en_stock', 'publie'].includes(v.status))
    .reduce((sum, v) => sum + (v.realBuyPrice ?? 0), 0);
  const budgetRestant = Math.max(0, budgetJournalier - capitalEngage);
  return {
    capitalEngage,
    budgetJournalier,
    budgetRestant,
    isConstrained: budgetRestant < 10_000,
    isExhausted: budgetRestant <= 0,
  };
}

export function computePerformanceKPIs(
  vehicles: VehicleSummary[],
  targetStockLevel = 10,
): PerformanceKPIs {
  const now = Date.now();
  const ms30 = 30 * 86_400_000;
  const ms7 = 7 * 86_400_000;

  const sold = vehicles.filter((v) => v.status === 'vendu');

  const soldLast30 = sold.filter((v) => {
    return v.soldAt != null && now - new Date(v.soldAt).getTime() <= ms30;
  });

  const soldLast7 = sold.filter((v) => {
    return v.soldAt != null && now - new Date(v.soldAt).getTime() <= ms7;
  });

  // Sort on separate copies to avoid mutating the same array twice.
  const makeStats = computeMakeStats(vehicles).filter((m) => m.sold >= 2);
  const byMarginDesc = [...makeStats].sort((a, b) => (b.avgMargin || 0) - (a.avgMargin || 0));
  const byMarginAsc  = [...makeStats].sort((a, b) => (a.avgMargin || 0) - (b.avgMargin || 0));
  const bestMake  = byMarginDesc[0]?.make || null;
  const worstMake = byMarginAsc[0]?.make || null;

  // Weekly buy target: to maintain stock, we need to replace what we sell.
  const avgSoldPerWeek = soldLast30.length / 4;
  const currentStock = vehicles.filter((v) => ['achete','en_stock','publie'].includes(v.status)).length;
  const deficit = Math.max(0, targetStockLevel - currentStock);
  const weeklyBuyTarget = Math.ceil(avgSoldPerWeek + deficit / 2);

  return {
    soldLast30: soldLast30.length,
    soldLast7: soldLast7.length,
    avgMarginLast30: avg(soldLast30.map((v) => v.realMargin).filter((m): m is number => m != null)),
    avgRotationLast30: avg(soldLast30.map((v) => v.soldInDays).filter((d): d is number => d != null)),
    bestMake,
    worstMake,
    weeklyBuyTarget,
  };
}

// ============================================================
// PREUVE — « Carmelo vs Réalité »
// Confronte les estimations de l'agent aux résultats réels.
// C'est l'outil de preuve de valeur (rétention SaaS) : il démontre,
// chiffres en main, que l'agent a eu raison.
// ============================================================

export type ProofMetrics = {
  // Précision de la marge estimée
  soldWithEstimate: number;          // véhicules vendus avec marge estimée ET réelle
  avgEstimatedMargin: number | null;
  avgRealMargin: number | null;
  marginMae: number | null;          // erreur absolue moyenne en €
  marginHitRate: number | null;      // % de véhicules où |estimé − réel| ≤ tolérance
  marginTolerance: number;           // tolérance utilisée (€)

  // Discipline d'achat — le prix réel a-t-il respecté le plafond Carmelo ?
  buyDisciplineCount: number;        // véhicules achetés avec prix réel ET plafond
  buyDisciplineRespected: number;    // dont realBuyPrice ≤ maxBuyPrice
  buyDisciplinePct: number | null;

  // Pertes évitées — décisions ROUGE (refus)
  refusedCount: number;
  estimatedLossAvoided: number | null; // somme des marges estimées négatives sur refus

  // Résultat des décisions positives
  greenBought: number;               // OR/VERT effectivement achetés
  greenSold: number;                 // dont vendus
  greenWinRatePct: number | null;    // vendus / achetés (décisions positives)

  // Valeur générée
  totalRealMargin: number;           // marge réelle cumulée (véhicules vendus)

  // Couverture des données (honnêteté)
  hasEnoughData: boolean;            // assez de véhicules vendus pour être crédible
};

function isPositiveDecision(d: string): boolean {
  return d === 'OR' || d === 'VERT';
}

export function computeProofMetrics(
  vehicles: VehicleSummary[],
  marginTolerance = 500,
  minSampleForCredibility = 5,
): ProofMetrics {
  const sold = vehicles.filter((v) => v.status === 'vendu');

  // --- Précision marge ---
  const soldWithEstimate = sold.filter(
    (v) => v.estimatedMargin != null && v.realMargin != null,
  );
  const absErrors = soldWithEstimate.map((v) =>
    Math.abs((v.estimatedMargin as number) - (v.realMargin as number)),
  );
  const marginHits = soldWithEstimate.filter(
    (v) => Math.abs((v.estimatedMargin as number) - (v.realMargin as number)) <= marginTolerance,
  );

  // --- Discipline d'achat ---
  const bought = vehicles.filter((v) =>
    ['achete', 'en_stock', 'publie', 'vendu'].includes(v.status),
  );
  const withBuyPrices = bought.filter(
    (v) => v.realBuyPrice != null && v.maxBuyPrice != null,
  );
  const respected = withBuyPrices.filter(
    (v) => (v.realBuyPrice as number) <= (v.maxBuyPrice as number),
  );

  // --- Pertes évitées (refus) ---
  const refused = vehicles.filter((v) => v.status === 'refuse' || v.decision === 'ROUGE');
  const lossAvoided = refused
    .map((v) => v.estimatedMargin)
    .filter((m): m is number => m != null && m < 0)
    .reduce((s, m) => s + Math.abs(m), 0);

  // --- Décisions positives ---
  const greenBought = bought.filter((v) => isPositiveDecision(v.decision));
  const greenSold = greenBought.filter((v) => v.status === 'vendu');

  return {
    soldWithEstimate: soldWithEstimate.length,
    avgEstimatedMargin: avg(soldWithEstimate.map((v) => v.estimatedMargin as number)),
    avgRealMargin: avg(soldWithEstimate.map((v) => v.realMargin as number)),
    marginMae: avg(absErrors),
    marginHitRate: soldWithEstimate.length > 0
      ? Math.round((marginHits.length / soldWithEstimate.length) * 100)
      : null,
    marginTolerance,

    buyDisciplineCount: withBuyPrices.length,
    buyDisciplineRespected: respected.length,
    buyDisciplinePct: withBuyPrices.length > 0
      ? Math.round((respected.length / withBuyPrices.length) * 100)
      : null,

    refusedCount: refused.length,
    estimatedLossAvoided: refused.length > 0 ? lossAvoided : null,

    greenBought: greenBought.length,
    greenSold: greenSold.length,
    greenWinRatePct: greenBought.length > 0
      ? Math.round((greenSold.length / greenBought.length) * 100)
      : null,

    totalRealMargin: sold.reduce((s, v) => s + (v.realMargin ?? 0), 0),

    hasEnoughData: sold.length >= minSampleForCredibility,
  };
}

// ============================================================
// CONTRÔLEUR — journal de blocages (rendre le garde-fou visible)
// Le Contrôleur évite l'erreur, donc on ne le "voit" jamais agir.
// Ces stats rendent son action visible : combien de décisions risquées bloquées.
// ============================================================

export type ControllerJournalItem = {
  id: number;
  make: string | null;
  model: string | null;
  year: number | null;
  decision: string | null;
  status: string | null;
  controllerValidated: boolean | null;
  requiresHumanValidation: boolean | null;
  controllerFlags: ControllerFlag[] | null;
  updatedAt: Date | null;
};

export type ControllerBlockage = {
  id: number;
  label: string;
  reasons: string[];       // messages des flags bloquants
  updatedAt: Date | null;
};

export type ControllerStats = {
  verifiedCount: number;       // véhicules passés par le Contrôleur (validés, sans bloquant)
  blockedCount: number;        // véhicules avec au moins un flag bloquant
  humanRequiredCount: number;  // véhicules en attente de validation humaine
  warningCount: number;        // véhicules avec avertissement (sans bloquant)
  blockedThisMonth: number;    // blocages sur les 30 derniers jours
  recentBlockages: ControllerBlockage[]; // détail des blocages récents (max 8)
};

function hasSeverity(flags: ControllerFlag[] | null, sev: ControllerFlag['severity']): boolean {
  return Array.isArray(flags) && flags.some((f) => f.severity === sev);
}

export function computeControllerStats(
  rows: ControllerJournalItem[],
  recentLimit = 8,
): ControllerStats {
  const now = Date.now();
  const ms30 = 30 * 86_400_000;

  const blocked = rows.filter((r) => hasSeverity(r.controllerFlags, 'bloquant'));
  const warnings = rows.filter(
    (r) => !hasSeverity(r.controllerFlags, 'bloquant') && hasSeverity(r.controllerFlags, 'avertissement'),
  );
  const verified = rows.filter(
    (r) => r.controllerValidated === true && !hasSeverity(r.controllerFlags, 'bloquant'),
  );
  const humanRequired = rows.filter((r) => r.requiresHumanValidation === true);

  const blockedThisMonth = blocked.filter(
    (r) => r.updatedAt != null && now - new Date(r.updatedAt).getTime() <= ms30,
  );

  const recentBlockages: ControllerBlockage[] = blocked
    .slice(0, recentLimit)
    .map((r) => ({
      id: r.id,
      label: [r.make, r.model, r.year].filter(Boolean).join(' ') || `Véhicule #${r.id}`,
      reasons: (r.controllerFlags ?? [])
        .filter((f) => f.severity === 'bloquant')
        .map((f) => f.message),
      updatedAt: r.updatedAt,
    }));

  return {
    verifiedCount: verified.length,
    blockedCount: blocked.length,
    humanRequiredCount: humanRequired.length,
    warningCount: warnings.length,
    blockedThisMonth: blockedThisMonth.length,
    recentBlockages,
  };
}
