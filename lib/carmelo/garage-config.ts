// lib/carmelo/garage-config.ts
// Configuration métier PAR GARAGE (multi-tenant — Option A, tenant = email).
//
// DEFAULT_GARAGE_CONFIG dérive de config.ts : config.ts reste la source unique
// des valeurs par défaut (les tests config.test.ts continuent de valider ces valeurs).
// Un garage qui ne configure rien hérite EXACTEMENT du comportement actuel de GP-CARS.
//
// Pattern d'injection identique à l'Agent Garantie (buildGarantieSystemPrompt(ruleset)).

import {
  COST_REFERENCE, MARGES, GP_CARS_PARAMS,
  MARQUES_PREFEREES, EXCLUSIONS_ABSOLUES,
} from './config';

export interface GarageConfig {
  /** Nom affiché du garage (annonces, communications, dashboard). */
  garageName: string;

  /** Postes de frais de référence (€). */
  costReference: {
    ct_carpass: number;
    preparation_standard: number;
    publicite: number;
    entretien: { min: number; max: number };
    transport_belgique: { min: number; max: number };
    transport_import: { min: number; max: number };
    pneus_4: { min: number; max: number };
    freins: { min: number; max: number };
    garantie: { min: number; max: number };
  };

  /** Marges minimales par segment (€). */
  margins: {
    standard: { cible: number; orange_min: number; rouge_seuil: number };
    premium: { cible: number; orange_min: number; rouge_seuil: number };
  };

  /** Paramètres opérationnels. */
  params: {
    plafond_achat_vehicule: number;
    budget_max_jour: number;
    seuil_confiance_autonome: number;
    coussin_negociation_client_pct: number;
  };

  marquesPreferees: string[];
  exclusionsAbsolues: string[];
}

/**
 * Valeurs par défaut — reproduisent à l'identique le comportement actuel.
 * Source unique : lib/carmelo/config.ts.
 */
export const DEFAULT_GARAGE_CONFIG: GarageConfig = {
  garageName: 'GP-CARS',
  costReference: {
    ct_carpass:           COST_REFERENCE.ct_carpass,
    preparation_standard: COST_REFERENCE.preparation_standard,
    publicite:            COST_REFERENCE.publicite,
    entretien:           { ...COST_REFERENCE.entretien },
    transport_belgique:  { ...COST_REFERENCE.transport_belgique },
    transport_import:    { ...COST_REFERENCE.transport_import },
    pneus_4:             { ...COST_REFERENCE.pneus_4 },
    freins:              { ...COST_REFERENCE.freins },
    garantie:            { ...COST_REFERENCE.garantie },
  },
  margins: {
    standard: { ...MARGES.standard },
    premium:  { ...MARGES.premium },
  },
  params: {
    plafond_achat_vehicule:         GP_CARS_PARAMS.plafond_achat_vehicule,
    budget_max_jour:                GP_CARS_PARAMS.budget_max_jour,
    seuil_confiance_autonome:       GP_CARS_PARAMS.seuil_confiance_autonome,
    coussin_negociation_client_pct: GP_CARS_PARAMS.coussin_negociation_client_pct,
  },
  marquesPreferees:  [...MARQUES_PREFEREES],
  exclusionsAbsolues: [...EXCLUSIONS_ABSOLUES],
};

/** Frais plancher incompressibles, dérivés de la config (CT + préparation + publicité). */
export function plancherFrais(config: GarageConfig): number {
  return config.costReference.ct_carpass
    + config.costReference.preparation_standard
    + config.costReference.publicite;
}

/**
 * Sous-ensemble de GarageConfig autorisé en override (tout est optionnel).
 * Stocké tel quel en base (JSONB) et fusionné sur les défauts.
 */
export type GarageConfigOverrides = {
  garageName?: string;
  costReference?: Partial<GarageConfig['costReference']>;
  margins?: {
    standard?: Partial<GarageConfig['margins']['standard']>;
    premium?: Partial<GarageConfig['margins']['premium']>;
  };
  params?: Partial<GarageConfig['params']>;
  marquesPreferees?: string[];
  exclusionsAbsolues?: string[];
};

/**
 * Fusionne des overrides partiels sur les défauts → config complète typée.
 * NULL / absent = valeur par défaut. Aucune validation métier ici (faite à l'écriture).
 */
export function mergeGarageConfig(overrides: GarageConfigOverrides | null | undefined): GarageConfig {
  if (!overrides) return DEFAULT_GARAGE_CONFIG;
  const d = DEFAULT_GARAGE_CONFIG;
  return {
    garageName: overrides.garageName ?? d.garageName,
    costReference: {
      ct_carpass:           overrides.costReference?.ct_carpass           ?? d.costReference.ct_carpass,
      preparation_standard: overrides.costReference?.preparation_standard ?? d.costReference.preparation_standard,
      publicite:            overrides.costReference?.publicite            ?? d.costReference.publicite,
      entretien:           { ...d.costReference.entretien,          ...overrides.costReference?.entretien },
      transport_belgique:  { ...d.costReference.transport_belgique, ...overrides.costReference?.transport_belgique },
      transport_import:    { ...d.costReference.transport_import,   ...overrides.costReference?.transport_import },
      pneus_4:             { ...d.costReference.pneus_4,            ...overrides.costReference?.pneus_4 },
      freins:              { ...d.costReference.freins,             ...overrides.costReference?.freins },
      garantie:            { ...d.costReference.garantie,           ...overrides.costReference?.garantie },
    },
    margins: {
      standard: { ...d.margins.standard, ...overrides.margins?.standard },
      premium:  { ...d.margins.premium,  ...overrides.margins?.premium },
    },
    params: { ...d.params, ...overrides.params },
    marquesPreferees:   overrides.marquesPreferees   ?? d.marquesPreferees,
    exclusionsAbsolues: overrides.exclusionsAbsolues ?? d.exclusionsAbsolues,
  };
}
