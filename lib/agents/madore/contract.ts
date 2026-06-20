export const MADORE_CONTRACT = {
  name:        'madore' as const,
  displayName: 'MADORE — Agent Commercial',
  version:     '1.9',
  description: 'Agent de qualification des prospects. Dialogue 24h/24 sur le site public, propose le stock en temps réel, score les leads et alerte immédiatement pour les prospects ROUGE.',

  emits: [
    'lead.rouge',
    'lead.orange',
    'lead.vert',
    'demande.marche',
  ] as const,

  consumes: [
    'atelier.pret_livrer',
    'vehicule.vendu',
  ] as const,

  owns: [
    'MadoreLead',
    'DemandSignal',
  ] as const,

  reads: [
    'Vehicle',
    'SystemEvent',
  ] as const,

  healthEndpoint: '/api/madore/health' as const,

  externalDeps: [
    { name: 'Anthropic Claude Haiku', required: true, envVar: 'ANTHROPIC_API_KEY' },
  ],
} as const;

export type MadoreEventEmitted  = typeof MADORE_CONTRACT.emits[number];
export type MadoreEventConsumed = typeof MADORE_CONTRACT.consumes[number];
