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

export type ControllerFlag = {
  code: string;
  severity: 'bloquant' | 'avertissement' | 'info';
  message: string;
};

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
};
