// Template pour créer un nouvel agent GP-CARS.
// Copier ce fichier dans lib/agents/<nom-agent>/contract.ts
// et remplir les valeurs.

export const TEMPLATE_CONTRACT = {
  name:        'template' as const,
  displayName: 'Nom de l\'agent — Description courte',
  version:     '1.0',
  description: 'Description détaillée de la mission de l\'agent.',

  emits: [
    // 'exemple.evenement.emis',
  ] as const,

  consumes: [
    // 'exemple.evenement.consomme',
  ] as const,

  owns: [
    // 'NomTable', // Tables DB que cet agent écrit exclusivement
  ] as const,

  reads: [
    'Vehicle',
    'SystemEvent',
  ] as const,

  healthEndpoint: '/api/template/health' as const,

  externalDeps: [] as Array<{
    name: string;
    required: boolean;
    envVar: string;
  }>,
} as const;

export type AgentContract = typeof TEMPLATE_CONTRACT;
