export const CONTROLLER_CONTRACT = {
  name:        'controller' as const,
  displayName: 'Contrôleur — Agent Qualité',
  version:     '3.2',
  description: 'Valide chaque décision critique avant exécution. Détecte les incohérences, vérifie les marges, bloque les décisions sur données insuffisantes. Dernier rempart avant toute action irréversible.',

  emits: [
    'validation.bloquee',
    'validation.approuvee',
    'validation.avertissement',
  ] as const,

  consumes: [
    'opportunite.or',
    'opportunite.vert',
    'atelier.frais_reels',
  ] as const,

  owns: [] as const,

  reads: [
    'Vehicle',
    'SystemEvent',
    'CarmeloAnalysis',
    'AtelierIntervention',
  ] as const,

  healthEndpoint: '/api/controller/health' as const,

  externalDeps: [],
} as const;

export type ControllerEventEmitted  = typeof CONTROLLER_CONTRACT.emits[number];
export type ControllerEventConsumed = typeof CONTROLLER_CONTRACT.consumes[number];
