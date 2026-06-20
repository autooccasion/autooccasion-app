export const MARKETING_CONTRACT = {
  name:        'marketing' as const,
  displayName: 'Marketing — Agent Annonces',
  version:     '1.4',
  description: 'Génère les descriptions d\'annonces optimisées, gère la rotation des prix (J+14/J+30/J+45/J+60) et signale les véhicules immobilisés.',

  emits: [
    'stock.immobilise',
    'prix.reduit',
    'annonce.publiee',
  ] as const,

  consumes: [
    'atelier.pret_vendre',
    'vehicule.achete',
  ] as const,

  owns: [
    'PriceHistory',
  ] as const,

  reads: [
    'Vehicle',
    'SystemEvent',
    'MadoreLead',
  ] as const,

  healthEndpoint: '/api/marketing/health' as const,

  externalDeps: [
    { name: 'Anthropic Claude Haiku', required: true, envVar: 'ANTHROPIC_API_KEY' },
    { name: 'AutoScout24 API',        required: false, envVar: 'AUTOSCOUT24_API_KEY' },
    { name: 'Resend Email',           required: true, envVar: 'RESEND_API_KEY' },
  ],
} as const;

export type MarketingEventEmitted  = typeof MARKETING_CONTRACT.emits[number];
export type MarketingEventConsumed = typeof MARKETING_CONTRACT.consumes[number];
