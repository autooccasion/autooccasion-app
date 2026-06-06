import { describe, it, expect } from 'vitest';
import { buildDigest } from './digest';

const DATE = new Date('2026-06-04T08:00:00Z');

describe('buildDigest', () => {
  it('reports an empty day', () => {
    const d = buildDigest([], DATE);
    expect(d.count).toBe(0);
    expect(d.text).toContain('aucune bonne affaire');
  });

  it('summarises opportunities with buy and resale prices', () => {
    const d = buildDigest(
      [
        { vehicule: 'Kia Stonic 2023', askingPrice: 12500, maxBuy: 12800, targetSell: 17300, url: 'https://autoscout24.be/x' },
        { vehicule: 'Toyota Yaris 2022', askingPrice: 13000, maxBuy: 13500, targetSell: 16500 },
      ],
      DATE,
    );
    expect(d.count).toBe(2);
    expect(d.title).toContain('2 bonnes affaires');
    expect(d.text).toContain('Kia Stonic 2023');
    // Numbers are formatted fr-BE (separator may be a narrow space); compare digits.
    const digits = d.text.replace(/\s/g, '');
    expect(digits).toContain('12800'); // achat max
    expect(digits).toContain('17300'); // revente cible
    expect(d.text).toContain('https://autoscout24.be/x');
  });

  it('uses the singular for a single deal', () => {
    const d = buildDigest([{ vehicule: 'BMW 320d', maxBuy: 20000, targetSell: 24000 }], DATE);
    expect(d.title).toContain('1 bonne affaire');
  });
});
