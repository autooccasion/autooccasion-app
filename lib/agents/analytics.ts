// Pure analytics functions over the Vehicle dataset.
// All inputs are plain arrays — no DB / network dependencies.

import type { VehicleSummary } from './shared-types';

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
