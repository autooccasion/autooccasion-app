// Carmelo — GP-CARS purchasing agent configuration
// Update these values to reflect GP-CARS real operational costs

export const COST_REFERENCE = {
  // Always applied (incompressible floor for any vehicle in good condition)
  ct_carpass: 105,
  preparation_standard: 100,
  publicite: 200,

  // Applied only when the vehicle actually requires it
  entretien: { min: 200, max: 300 },
  transport_belgique: { min: 0, max: 200 },
  transport_import: { min: 250, max: 400 },

  // Estimated ranges for conditional items
  pneus_4: { min: 300, max: 600 },
  freins: { min: 200, max: 400 },
  garantie: { min: 300, max: 600 },

  // Carrosserie: always use real quote — never estimate
  carrosserie: 'devis_reel',
} as const;

// Incompressible floor for a vehicle in good condition
export const PLANCHER_FRAIS = 405; // ct_carpass + preparation_standard + publicite

export const COST_CHECKLIST = [
  'entretien_recent_documente',
  'pneus_50_pct_min',
  'freins_corrects',
  'carrosserie_sans_defaut',
  'garantie_constructeur_restante',
  'ct_valide_belgique',
  'distance_transport_km',
] as const;

export const MARGES = {
  // Vehicles 5,000 – 20,000 €
  standard: {
    cible: 3000,
    orange_min: 2500,
    rouge_seuil: 2500,
  },
  // Vehicles > 25,000 € (20k–25k defaults to premium tier)
  premium: {
    cible: 4000,
    orange_min: 3500,
    rouge_seuil: 3500,
  },
} as const;

// Score rotation thresholds
export const ROTATION = {
  tres_liquide: { min: 9, max: 10, delai_jours: 30 },
  liquide: { min: 7, max: 8, delai_jours: 60 },
  moyen: { min: 5, max: 6, delai_jours: 90 },
  lent: { min: 0, max: 4, delai_jours: 120 },
} as const;

// Configurable operational parameters — fill in GP-CARS real values
export const GP_CARS_PARAMS = {
  plafond_achat_vehicule: null as number | null,  // e.g. 25000
  budget_max_jour: null as number | null,          // e.g. 40000
  seuil_confiance_autonome: null as number | null, // e.g. 85 (percent)
  coussin_negociation_client_pct: 3,               // 3–5% of sale price
};

// Preferred brands (subject to profitability check)
export const MARQUES_PREFEREES = [
  'Kia', 'Hyundai', 'Toyota', 'Volkswagen', 'Audi', 'BMW', 'Mercedes',
] as const;

// Absolute exclusions
export const EXCLUSIONS_ABSOLUES = [
  'Moteurs PSA PureTech',
  'Historique douteux',
  'Kilométrage incohérent',
  'Entretien absent ou non documenté',
  'Import douteux avec historique incomplet',
  'Véhicule accidenté lourdement',
  'Couleur difficile (rouge, beige, atypique)',
  'Modèle à risque mécanique connu élevé',
  'Marge cible non atteignable',
] as const;
