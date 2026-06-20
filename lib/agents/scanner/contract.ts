export const SCANNER_CONTRACT = {
  name:        'scanner' as const,
  displayName: 'Scanner — Agent Veille',
  version:     '1.1',
  description: 'Surveille les annonces automobiles en continu. Soumet chaque annonce détectée à Carmelo et émet des alertes immédiates pour les opportunités OR. Tourne automatiquement 2× par jour.',

  emits: [
    'opportunite.detectee',
    'prix.baisse',
  ] as const,

  consumes: [] as const,

  owns: [] as const,

  reads: [
    'Vehicle',
    'SystemEvent',
    'PriceHistory',
  ] as const,

  healthEndpoint: '/api/scanner/health' as const,

  externalDeps: [
    { name: 'ScraperAPI',            required: true, envVar: 'SCRAPERAPI_KEY' },
    { name: 'Anthropic Claude Opus', required: true, envVar: 'ANTHROPIC_API_KEY' },
  ],
} as const;

export type ScannerEventEmitted = typeof SCANNER_CONTRACT.emits[number];
