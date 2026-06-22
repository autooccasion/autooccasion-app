// Central shared types for all GP-CARS agents.
// Every agent reads and writes to the same Vehicle lifecycle.

export type VehicleStatus =
  | 'prospect'   // detected opportunity, not yet analysed
  | 'analyse'    // Carmelo has run analysis
  | 'achete'     // purchased
  | 'en_stock'   // in stock, not yet published
  | 'publie'     // listing live on platforms
  | 'vendu'      // sold
  | 'refuse';    // rejected (Carmelo rouge or human decision)

export type AgentDecision = 'VERT' | 'ORANGE' | 'ROUGE' | 'INCONNU';

// 4-tier action classification surfaced to the user after verdict + controller.
export type ActionRecommandee = 'ACHETER' | 'NÉGOCIER' | 'SURVEILLER' | 'REJETER';

export type ControllerFlag = {
  code: string;
  severity: 'bloquant' | 'avertissement' | 'info';
  message: string;
};

export type GarantieStatus       = 'nouveau' | 'en_analyse' | 'decision_prise' | 'sav_en_cours' | 'resolu' | 'litige' | 'expertise' | 'procedure';
export type GarantieCategory     = '1' | '2' | '3' | '4' | '5' | '6' | '7';
export type GarantieCoverage     = 'totale' | 'partielle' | 'refusee' | 'en_attente';
export type GarantieDocumentType = 'email' | 'whatsapp' | 'photo' | 'video' | 'devis' | 'facture' | 'diagnostic' | 'rapport_atelier' | 'expertise' | 'courrier' | 'autre';

export type AtelierInterventionStatus = 'planifie' | 'en_cours' | 'termine' | 'facture';
export type AtelierInterventionType   = 'revision' | 'reparation' | 'preparation_vente' | 'diagnostic' | 'autre';
export type PieceStatus               = 'a_commander' | 'commande' | 'recu' | 'monte';
export type RdvType                   = 'diagnostic' | 'intervention' | 'livraison' | 'reprise_trade_in' | 'essai';
export type RdvStatus                 = 'planifie' | 'confirme' | 'annule' | 'termine';

export type MandatStatus      = 'nouveau' | 'contacte' | 'rdv' | 'mandat' | 'perdu' | 'rejete';
export type MandatPriorite    = 'A' | 'B' | 'C' | 'rejet';
export type MandatUrgence     = 'faible' | 'moyenne' | 'forte' | 'tres_forte';
export type MandatRentabilite = 'faible' | 'correcte' | 'bonne' | 'excellente';
export type ContactCanal      = 'sms' | 'whatsapp' | 'email' | 'telephone' | 'messenger';
export type ContactResultat   = 'interesse' | 'negatif' | 'pas_reponse' | 'rdv_fixe' | 'mandat_signe';

// GAE types
export type GaeOpportuniteType = 'achat' | 'mandat' | 'vente' | 'garantie' | 'atelier' | 'lead' | 'marketing' | 'financement';
export type GaeAgentSource     = 'carmelo' | 'mandats' | 'madore' | 'garantie' | 'atelier' | 'marketing' | 'manuel';
export type GaeStatus          = 'detectee' | 'contactee' | 'qualifiee' | 'rdv' | 'negociation' | 'transformee' | 'perdue' | 'annulee';
export type ConfidenceScore    = 0 | 25 | 50 | 75 | 100;

// Lightweight vehicle summary passed between agents.
export type VehicleSummary = {
  id: number;
  make: string | null;
  model: string | null;
  year: number | null;
  km: number | null;
  fuel: string | null;
  status: VehicleStatus;
  askingPrice: number | null;
  maxBuyPrice: number | null;
  realBuyPrice: number | null;
  realSellPrice: number | null;
  decision: AgentDecision;
  soldInDays: number | null;
  realMargin: number | null;
  estimatedMargin: number | null;
  confidence: number | null;
  publishedAt: Date | null;
  soldAt: Date | null;
};
