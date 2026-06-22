export const MANDATS_CONTRACT = {
  name: 'mandats' as const,
  displayName: 'Mandats — Agent Acquisition VO',
  version: '1.0',
  emits: ['mandats.opportunite_detectee', 'mandats.priorite_a', 'mandats.mandat_signe', 'mandats.relance_due'] as const,
  consumes: [] as const,
  owns: ['MandatOpportunite', 'MandatContact', 'MandatRelance', 'MandatMandat'] as const,
  reads: ['Vehicle', 'SystemEvent'] as const,
  healthEndpoint: '/api/mandats/health' as const,
  externalDeps: [{ name: 'Anthropic Claude Opus', required: true, envVar: 'ANTHROPIC_API_KEY' }],
} as const;
