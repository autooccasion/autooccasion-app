// lib/agents/garantie/ruleset.ts
// Source unique de vérité légale pour l'Agent Garantie.
// Toute modification doit incrémenter la version et être validée par Jean-François.

export interface GarantieRuleset {
  version: string;
  status: 'VALIDE' | 'BROUILLON' | 'ARCHIVE';
  validatedBy: string | null;
  validatedAt: string | null;

  // Durées
  warrantyDurationMonthsOccasion: number;       // min légal = 12 mois
  presumptionPeriodMonths: number;               // 6 mois (Directive 2019/771/UE)
  warrantyDurationMonthsNeuf: number;            // 24 mois

  // Éligibilité acheteur
  eligibleBuyerTypes: ('particulier' | 'consommateur_assimile')[];
  excludedBuyerTypes: ('societe' | 'assujetti_tva' | 'usage_professionnel')[];

  // Exclusions légales
  exclusions: string[];

  // Usure normale — seuils kilométriques indicatifs
  wearThresholdsKm: Record<string, { min: number; max: number }>;
  wearThresholdsMonths: Record<string, { min: number; max: number }>;

  // Voies de recours à mentionner en cas de refus
  recoursOptions: string[];

  // Base légale
  legalBasis: string[];
}

export const GARANTIE_RULESET_V1: GarantieRuleset = {
  version: '1.0',
  status: 'VALIDE',
  validatedBy: 'Jean-François',
  validatedAt: '2026-06-24',

  warrantyDurationMonthsOccasion: 12,
  presumptionPeriodMonths: 6,
  warrantyDurationMonthsNeuf: 24,

  eligibleBuyerTypes: ['particulier', 'consommateur_assimile'],
  excludedBuyerTypes: ['societe', 'assujetti_tva', 'usage_professionnel'],

  exclusions: [
    'Usure normale documentée et proportionnelle à l\'âge et au kilométrage',
    'Défaut causé par une mauvaise utilisation du consommateur',
    'Défaut consécutif à un accident post-vente imputable au consommateur ou à un tiers',
    'Défaut consécutif à un défaut d\'entretien du consommateur (vidange, distribution, etc.)',
    'Modifications ou réparations post-vente effectuées hors réseau agréé sans accord GP-CARS',
    'Défaut connu et signalé avant la vente, accepté contractuellement par l\'acheteur',
    'Dommages liés à un phénomène extérieur (intempérie, vandalisme, catastrophe naturelle)',
  ],

  wearThresholdsKm: {
    'Plaquettes de frein avant':   { min: 25000,  max: 50000  },
    'Plaquettes de frein arrière': { min: 40000,  max: 70000  },
    'Disques de frein':            { min: 60000,  max: 100000 },
    'Embrayage (conduite normale)':{ min: 100000, max: 150000 },
    'Embrayage (conduite sportive/urbaine)': { min: 60000, max: 90000 },
    'Courroie de distribution':    { min: 60000,  max: 120000 },
    'Courroie accessoires':        { min: 80000,  max: 120000 },
    'Batterie 12V':                { min: 80000,  max: 100000 },
    'Amortisseurs':                { min: 80000,  max: 120000 },
    'Silent-blocs':                { min: 80000,  max: 120000 },
    'Turbocompresseur':            { min: 150000, max: 200000 },
    'Alternateur':                 { min: 150000, max: 200000 },
    'Démarreur':                   { min: 150000, max: 200000 },
    'Injecteurs diesel':           { min: 120000, max: 180000 },
    'Pneumatiques':                { min: 30000,  max: 50000  },
  },

  wearThresholdsMonths: {
    'Batterie 12V':                { min: 48, max: 72 },
    'Courroie de distribution':    { min: 72, max: 96 },
    'Pneumatiques':                { min: 60, max: 72 },
  },

  recoursOptions: [
    'Médiation de la consommation — Belmed (belmed.be)',
    'Service de Médiation pour le Consommateur (mediationconsommateur.be)',
    'Juridiction de paix compétente pour les litiges < 5 000 €',
    'Tribunal de première instance pour les litiges ≥ 5 000 €',
  ],

  legalBasis: [
    'Code de droit économique belge (CDE) — Art. VI.7 à VI.10 et Art. VII.1 ss',
    'Directive européenne 2019/771/UE relative aux contrats de vente de biens',
    'Transposition belge par la loi du 20 novembre 2022',
  ],
};

// Toujours utiliser cette constante — ne jamais hard-coder les valeurs directement.
export const ACTIVE_RULESET = GARANTIE_RULESET_V1;
