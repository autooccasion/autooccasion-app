import { describe, it, expect } from 'vitest';
import { extractDecision } from './decision';

describe('extractDecision', () => {
  it('detects a green decision', () => {
    expect(extractDecision('Décision : 🟢 VERT')).toBe('VERT');
  });

  it('detects an orange decision', () => {
    expect(extractDecision('Décision : 🟠 ORANGE')).toBe('ORANGE');
  });

  it('detects a red decision', () => {
    expect(extractDecision('Décision : 🔴 ROUGE')).toBe('ROUGE');
  });

  it('prioritises ROUGE when several zones are mentioned', () => {
    // A refusal must win even if the body discusses the orange/green zones.
    const analyse =
      'Marge en zone orange, mais risque mécanique → Décision : ROUGE. Zone verte non atteignable.';
    expect(extractDecision(analyse)).toBe('ROUGE');
  });

  it('prioritises ORANGE over VERT', () => {
    const analyse = 'Zone verte difficile, donc ORANGE.';
    expect(extractDecision(analyse)).toBe('ORANGE');
  });

  it('returns INCONNU when no decision is present', () => {
    expect(extractDecision('Analyse incomplète, données manquantes.')).toBe('INCONNU');
  });

  it('handles empty input safely', () => {
    expect(extractDecision('')).toBe('INCONNU');
  });
});
