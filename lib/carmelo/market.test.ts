import { describe, it, expect } from 'vitest';
import {
  computeStats,
  positionPrice,
  evaluateOpportunity,
} from './market';

describe('computeStats', () => {
  it('returns null below the minimum sample', () => {
    expect(computeStats([18000, 17000])).toBeNull();
  });

  it('computes median and quartiles', () => {
    const s = computeStats([16900, 17500, 17900, 18200, 18500, 19000]);
    expect(s).not.toBeNull();
    expect(s!.sample).toBe(6);
    expect(s!.median).toBe(18050);
    expect(s!.min).toBe(16900);
    expect(s!.max).toBe(19000);
  });

  it('ignores non-positive / invalid prices', () => {
    const s = computeStats([0, -5, 10000, 11000, 12000, NaN]);
    expect(s!.sample).toBe(3);
  });
});

describe('positionPrice', () => {
  const s = computeStats([16900, 17500, 17900, 18200, 18500, 19000])!;
  it('labels a clearly cheap price as a very good deal', () => {
    expect(positionPrice(15000, s)).toBe('tres_bonne_affaire');
  });
  it('labels a near-median price as correct', () => {
    expect(positionPrice(18000, s)).toBe('correct');
  });
  it('labels an expensive price as high', () => {
    expect(positionPrice(20500, s)).toBe('tres_eleve');
  });
});

describe('evaluateOpportunity', () => {
  const s = computeStats([16900, 17500, 17900, 18200, 18500, 19000])!;

  it('flags a clear margin as a green good deal', () => {
    const o = evaluateOpportunity(12500, s);
    expect(o.zone).toBe('vert');
    expect(o.isGoodDeal).toBe(true);
    expect(o.maxBuy).toBeGreaterThan(o.askingPrice);
  });

  it('positions our resale as a good deal for fast rotation', () => {
    const o = evaluateOpportunity(12500, s);
    expect(o.targetSell).toBeLessThan(s.median);
    expect(['tres_bonne_affaire', 'bonne_affaire']).toContain(o.targetPositioning);
  });

  it('rejects a thin margin as red', () => {
    const o = evaluateOpportunity(15000, s);
    expect(o.zone).toBe('rouge');
    expect(o.isGoodDeal).toBe(false);
  });

  it('refuses anything above the purchase ceiling', () => {
    const pricey = computeStats([40000, 41000, 42000, 43000])!;
    const o = evaluateOpportunity(30000, pricey);
    expect(o.exceedsCeiling).toBe(true);
    expect(o.isGoodDeal).toBe(false);
  });
});
