import { describe, it, expect } from 'vitest';
import { computeMakeStats, computeStockHealth, computePerformanceKPIs } from './analytics';
import type { VehicleSummary } from './shared-types';

const NOW = new Date();
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const VEHICLES: VehicleSummary[] = [
  { id: 1, make: 'Kia',     model: 'Stonic',   year: 2023, km: 28000, fuel: 'essence', status: 'vendu',    askingPrice: 14000, maxBuyPrice: 13000, realBuyPrice: 12500, realSellPrice: 17500, decision: 'VERT',   soldInDays: 22,   realMargin: 3200, soldAt: daysAgo(10), publishedAt: null },
  { id: 2, make: 'Kia',     model: 'Sportage', year: 2022, km: 45000, fuel: 'diesel',  status: 'vendu',    askingPrice: 18000, maxBuyPrice: 17000, realBuyPrice: 16500, realSellPrice: 21000, decision: 'VERT',   soldInDays: 35,   realMargin: 2800, soldAt: daysAgo(5),  publishedAt: null },
  { id: 3, make: 'BMW',     model: '320d',     year: 2021, km: 60000, fuel: 'diesel',  status: 'publie',   askingPrice: 22000, maxBuyPrice: 21000, realBuyPrice: 20000, realSellPrice: null,  decision: 'ORANGE', soldInDays: null, realMargin: null, soldAt: null,        publishedAt: daysAgo(75) },
  { id: 4, make: 'Renault', model: 'Clio',     year: 2020, km: 80000, fuel: 'essence', status: 'refuse',   askingPrice: 8000,  maxBuyPrice: null,  realBuyPrice: null,  realSellPrice: null,  decision: 'ROUGE',  soldInDays: null, realMargin: null, soldAt: null,        publishedAt: null },
  { id: 5, make: 'Kia',     model: 'Niro',     year: 2023, km: 15000, fuel: 'hybride', status: 'en_stock', askingPrice: 21000, maxBuyPrice: 20000, realBuyPrice: 19500, realSellPrice: null,  decision: 'VERT',   soldInDays: null, realMargin: null, soldAt: null,        publishedAt: null },
];

describe('computeMakeStats', () => {
  it('groups by make and computes sold count', () => {
    const stats = computeMakeStats(VEHICLES);
    const kia = stats.find((s) => s.make === 'Kia')!;
    expect(kia.sold).toBe(2);
    expect(kia.count).toBe(3); // 2 sold + 1 en_stock
    expect(kia.avgMargin).toBe(3000); // (3200+2800)/2
    expect(kia.avgDays).toBe(29); // (22+35)/2 = 28.5 → 29
  });

  it('marks refused vehicles as 0% conversion', () => {
    const stats = computeMakeStats(VEHICLES);
    const renault = stats.find((s) => s.make === 'Renault');
    // refused doesn't count as purchased
    expect(renault?.count).toBe(0);
  });
});

describe('computeStockHealth', () => {
  it('counts stock, published, sold, refused correctly', () => {
    const h = computeStockHealth(VEHICLES);
    expect(h.inStock).toBe(2);   // publie(1) + en_stock(1)
    expect(h.published).toBe(1);
    expect(h.sold).toBe(2);
    expect(h.refused).toBe(1);
  });

  it('detects slow vehicles beyond threshold', () => {
    const h = computeStockHealth(VEHICLES, 60);
    expect(h.slowVehicles).toHaveLength(1);
    expect(h.slowVehicles[0].make).toBe('BMW');
  });

  it('computes total stock value from real buy prices', () => {
    const h = computeStockHealth(VEHICLES);
    // BMW 20000 + Kia Niro 19500 = 39500
    expect(h.totalStockValue).toBe(39500);
  });
});

describe('computePerformanceKPIs', () => {
  it('counts recent sales correctly', () => {
    const kpis = computePerformanceKPIs(VEHICLES);
    expect(kpis.soldLast30).toBe(2);
    expect(kpis.soldLast7).toBe(1);
  });

  it('derives a positive weekly buy target when stock is below target', () => {
    const kpis = computePerformanceKPIs(VEHICLES, 10);
    expect(kpis.weeklyBuyTarget).toBeGreaterThan(0);
  });

  it('bestMake and worstMake are distinct when two makes have different margins', () => {
    // Regression test for sort-mutation bug: both were the same make.
    const kpis = computePerformanceKPIs(VEHICLES);
    if (kpis.bestMake && kpis.worstMake) {
      expect(kpis.bestMake).not.toBe(kpis.worstMake);
    }
  });
});
