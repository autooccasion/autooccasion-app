export const CARMELO_CONTRACT = {
  name:        'carmelo' as const,
  displayName: 'Carmelo — Agent Achats',
  version:     '2.8',
  description: 'Analyse les véhicules avant achat. Calcule le prix maximum d\'achat, la marge estimée, le score de rotation et le risque. Émet des alertes immédiates pour les opportunités OR/VERT.',

  emits: [
    'opportunite.or',
    'opportunite.vert',
    'opportunite.orange',
    'vehicule.refuse',
    'vehicule.achete',
    'vehicule.vendu',
    'analyse.low_confidence',
    // prix.baisse est émis par le Scanner (détection inter-scans), pas par Carmelo
  ] as const,

  consumes: [
    'demande.marche',
  ] as const,

  owns: [
    'CarmeloAnalysis',
    'CarmeloOpportunity',
    'PriceHistory',
  ] as const,

  reads: [
    'Vehicle',
    'SystemEvent',
    'DemandSignal',
  ] as const,

  healthEndpoint: '/api/carmelo/health' as const,

  externalDeps: [
    { name: 'Anthropic Claude Opus', required: true,  envVar: 'ANTHROPIC_API_KEY' },
    { name: 'ScraperAPI',            required: true,  envVar: 'SCRAPERAPI_KEY' },
    { name: 'CarVertical VIN',       required: false, envVar: 'CARVERTICAL_API_KEY' },
  ],
} as const;

export type CarmeloEventEmitted   = typeof CARMELO_CONTRACT.emits[number];
export type CarmeloEventConsumed  = typeof CARMELO_CONTRACT.consumes[number];
