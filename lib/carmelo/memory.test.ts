import { describe, it, expect } from 'vitest';
import { selectRelevant, buildMemoryBlock, type LearningRecord } from './memory';

const RECORDS: LearningRecord[] = [
  { vehiculeResume: 'Kia Stonic 2023', make: 'Kia', status: 'vendu', realBuyPrice: 13500, realSellPrice: 17500, soldInDays: 22, decision: 'VERT' },
  { vehiculeResume: 'BMW 320d 2021', make: 'BMW', status: 'achete', realBuyPrice: 21000, decision: 'ORANGE' },
  { vehiculeResume: 'Audi A3 2020', make: 'Audi', status: 'analyse', recommendedMaxBuy: 15000, decision: 'ROUGE' },
];

describe('selectRelevant', () => {
  it('prioritises same-make records', () => {
    const out = selectRelevant(RECORDS, 'Recherche Kia Stonic 1.0 28000 km');
    expect(out[0].make).toBe('Kia');
  });

  it('falls back to real sales when nothing matches', () => {
    const out = selectRelevant(RECORDS, 'Volkswagen Golf diesel');
    expect(out.length).toBe(1);
    expect(out[0].status).toBe('vendu');
  });
});

describe('buildMemoryBlock', () => {
  it('returns an empty string with no records', () => {
    expect(buildMemoryBlock([])).toBe('');
  });

  it('renders sold vehicles with real buy/sell and delay', () => {
    const block = buildMemoryBlock([RECORDS[0]]);
    expect(block).toContain('VENDU');
    expect(block).toContain('22 j');
    expect(block).toContain('MÉMOIRE GP-CARS');
  });

  it('renders analysed-only records with the recommended max buy', () => {
    const block = buildMemoryBlock([RECORDS[2]]);
    expect(block).toContain('ANALYSÉ');
    expect(block).toContain('conseil achat max');
  });
});
