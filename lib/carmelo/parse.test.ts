import { describe, it, expect } from 'vitest';
import { parseReport } from './parse';

const SAMPLE = `Véhicule :                Kia Stonic 1.0 T-GDI / 2023 / 28 000 km / essence DCT7
Décision :                🟢 VERT

─── CHIFFRES ───────────────────────────────────────────
Prix marché réel :        18 500 €  (AutoScout24)
Prix de vente réaliste :  17 900 €
  TOTAL FRAIS :           405 €
PRIX MAXIMUM À REMETTRE : 13 800 €

─── VERDICT ────────────────────────────────────────────
Marge estimée :           3 200 €  (zone : verte)
Score Rotation :          8 /10
Rotation probable :       45 jours
Niveau de confiance :     82 %
`;

describe('parseReport', () => {
  const parsed = parseReport(SAMPLE);

  it('extracts the vehicle summary and make', () => {
    expect(parsed.vehiculeResume).toContain('Kia Stonic');
    expect(parsed.make).toBe('Kia');
  });

  it('reads the decision', () => {
    expect(parsed.decision).toBe('VERT');
  });

  it('parses European-formatted prices to integers', () => {
    expect(parsed.marketPrice).toBe(18500);
    expect(parsed.recommendedMaxBuy).toBe(13800);
    expect(parsed.estimatedMargin).toBe(3200);
  });

  it('parses rotation score and confidence', () => {
    expect(parsed.rotationScore).toBe(8);
    expect(parsed.confidence).toBe(82);
  });

  it('returns nulls on an empty or unstructured report', () => {
    const empty = parseReport('aucune donnée');
    expect(empty.recommendedMaxBuy).toBeNull();
    expect(empty.make).toBeNull();
    expect(empty.decision).toBe('INCONNU');
  });
});
