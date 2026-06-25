export const MANDATS_CONTRACT = {
  name:        'mandats' as const,
  displayName: 'Mandats — Agent Acquisition VO',
  version:     '1.0',
  description: 'Identifie les particuliers qui veulent vendre leur véhicule. Analyse les annonces, détecte les opportunités de mandat, génère les messages de prise de contact et planifie les relances J+2, J+7, J+14.',

  emits: [
    'mandats.opportunite_detectee',
    'mandats.priorite_a',
    'mandats.mandat_signe',
    'mandats.relance_due',
  ] as const,

  consumes: [] as const,

  owns: [
    'MandatOpportunite',
    'MandatContact',
    'MandatRelance',
    'MandatMandat',
  ] as const,

  reads: [
    'Vehicle',
    'SystemEvent',
  ] as const,

  healthEndpoint: '/api/mandats/health' as const,

  externalDeps: [
    { name: 'Anthropic Claude Opus', required: true, envVar: 'ANTHROPIC_API_KEY' },
  ],
} as const;

export type MandatsEventEmitted  = typeof MANDATS_CONTRACT.emits[number];
export type MandatsEventConsumed = typeof MANDATS_CONTRACT.consumes[number];
