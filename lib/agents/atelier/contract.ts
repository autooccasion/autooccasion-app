export const ATELIER_CONTRACT = {
  name:        'atelier' as const,
  displayName: 'Atelier — Agent Mécanique & RDV',
  version:     '1.0',
  description: 'Gère le cycle de vie technique des véhicules achetés : interventions mécaniques, commande de pièces, génération de messages fournisseurs, et planification des rendez-vous. Émet les frais réels vers le Contrôleur pour recalcul de marge.',

  emits: [
    'atelier.intervention_creee',
    'atelier.frais_reels',
    'atelier.pret_vendre',
    'atelier.pret_livrer',
    'rdv.confirme',
    'rdv.rappel',
  ] as const,

  consumes: [] as const,

  owns: [
    'AtelierIntervention',
    'PieceCommande',
    'RdvAtelier',
  ] as const,

  reads: [
    'Vehicle',
    'MadoreLead',
    'SystemEvent',
  ] as const,

  healthEndpoint: '/api/atelier/health' as const,

  externalDeps: [],
} as const;

export type AtelierEventEmitted  = typeof ATELIER_CONTRACT.emits[number];
export type AtelierEventConsumed = typeof ATELIER_CONTRACT.consumes[number];
