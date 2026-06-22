import { describe, it, expect } from 'vitest';
import { COST_REFERENCE, PLANCHER_FRAIS, GP_CARS_PARAMS, MARGES } from './config';

describe('config', () => {
  it('PLANCHER_FRAIS equals the sum of incompressible costs', () => {
    const expected =
      COST_REFERENCE.ct_carpass +
      COST_REFERENCE.preparation_standard +
      COST_REFERENCE.publicite;
    expect(PLANCHER_FRAIS).toBe(expected);
  });

  it('operational parameters are configured (not null)', () => {
    expect(GP_CARS_PARAMS.plafond_achat_vehicule).toBeTypeOf('number');
    expect(GP_CARS_PARAMS.budget_max_jour).toBeTypeOf('number');
    expect(GP_CARS_PARAMS.seuil_confiance_autonome).toBeTypeOf('number');
  });

  it('confidence threshold is a sane percentage', () => {
    const seuil = GP_CARS_PARAMS.seuil_confiance_autonome!;
    expect(seuil).toBeGreaterThan(0);
    expect(seuil).toBeLessThanOrEqual(100);
  });

  it('negotiation cushion stays within the 3–5% policy range', () => {
    expect(GP_CARS_PARAMS.coussin_negociation_client_pct).toBeGreaterThanOrEqual(3);
    expect(GP_CARS_PARAMS.coussin_negociation_client_pct).toBeLessThanOrEqual(5);
  });

  it('premium margin target is higher than standard', () => {
    expect(MARGES.premium.cible).toBeGreaterThan(MARGES.standard.cible);
  });
});
