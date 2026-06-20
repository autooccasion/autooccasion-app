export const GARANTIE_CONTRACT = {
  name:        'garantie' as const,
  displayName: 'Garantie — Agent SAV & Litiges',
  version:     '1.0',
  description: 'Analyse les dossiers de garantie et SAV selon le droit belge de la consommation. Calcule la vétusté des pièces, détermine la catégorie de décision (1-7), génère les communications client et prépare les dossiers de litige. Agent totalement indépendant — sa panne ne bloque aucun autre agent.',

  emits: [
    'garantie.dossier_cree',
    'garantie.decision',
    'garantie.litige_detecte',
  ] as const,

  consumes: [] as const,

  owns: [
    'GarantieDossier',
    'GarantieDocument',
    'GarantiePiece',
  ] as const,

  reads: [
    'Vehicle',
    'AtelierIntervention',
    'SystemEvent',
  ] as const,

  healthEndpoint: '/api/garantie/health' as const,

  externalDeps: [
    { name: 'Anthropic Claude Opus', required: true, envVar: 'ANTHROPIC_API_KEY' },
  ],
} as const;

export type GarantieEventEmitted  = typeof GARANTIE_CONTRACT.emits[number];
export type GarantieEventConsumed = typeof GARANTIE_CONTRACT.consumes[number];
