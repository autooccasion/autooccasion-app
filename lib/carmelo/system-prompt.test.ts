import { describe, it, expect } from 'vitest';
import { buildCarmeloSystemPrompt } from './system-prompt';
import { GP_CARS_PARAMS, EXCLUSIONS_ABSOLUES } from './config';

describe('buildCarmeloSystemPrompt', () => {
  const prompt = buildCarmeloSystemPrompt();

  it('identifies the agent as Carmelo for GP-CARS', () => {
    expect(prompt).toContain('Carmelo');
    expect(prompt).toContain('GP-CARS');
  });

  it('embeds every absolute exclusion', () => {
    for (const exclusion of EXCLUSIONS_ABSOLUES) {
      expect(prompt).toContain(exclusion);
    }
  });

  it('wires in the operational constraints', () => {
    expect(prompt).toContain(String(GP_CARS_PARAMS.seuil_confiance_autonome));
    expect(prompt).toContain('VALIDATION HUMAINE REQUISE');
    // Purchase ceiling is rendered with a thousands separator (fr-BE).
    expect(prompt).toContain(
      GP_CARS_PARAMS.plafond_achat_vehicule.toLocaleString('fr-BE'),
    );
  });

  it('enforces the mandatory output format', () => {
    expect(prompt).toContain('PRIX MAXIMUM À REMETTRE');
    expect(prompt).toContain('Score Rotation');
    expect(prompt).toContain('Niveau de confiance');
  });

  it('keeps the integrity guardrail against fabricated prices', () => {
    expect(prompt).toContain('jamais');
    expect(prompt.toLowerCase()).toContain('confiance');
  });
});
