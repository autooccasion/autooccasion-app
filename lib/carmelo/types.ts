export type DecisionVehicule = 'VERT' | 'OR' | 'ORANGE' | 'ROUGE';
export type ZoneMarge = 'verte' | 'orange' | 'exceptionnelle' | 'rouge';
export type NiveauRisque = 'blacklist' | 'eleve' | 'modere' | 'faible' | 'excellent';
export type TypeRotation = 'tres_rapide' | 'rapide' | 'moyenne' | 'lente';
export type TypeVehicule = 'citadine' | 'berline' | 'suv' | 'break' | 'sportive' | 'utilitaire' | 'autre';
export type PaysOrigine = 'BE' | 'FR' | 'DE' | 'NL' | 'LU' | 'autre';

export interface VehicleData {
  // Identite
  marque: string;
  modele: string;
  annee: number;
  kilometrage: number;
  motorisation: string;
  codeMoteur?: string;          // BMW N47, EA211, etc.
  boite: 'manuelle' | 'automatique';
  couleur: string;
  finition?: string;            // GTI, AMG, Sport, etc.
  typeVehicule: TypeVehicule;

  // Prix
  prixDemande: number;
  prixMarcheEstime: number;
  prixVNReference?: number;     // remised new car price for same model

  // Etat
  entretienRecent: boolean;
  devisEntretien?: number;
  pneusOk: boolean;
  devisPneus?: number;
  freinsOk: boolean;
  devisFreins?: number;
  carrosseriePropre: boolean;
  devisCarrosserie?: number;
  garantieConstructeur: boolean;
  ctValide: boolean;

  // Logistique
  distanceKm: number;
  paysOrigine: PaysOrigine;
}

export interface FraisDetail {
  ct: number;
  preparation: number;
  publicite: number;
  entretien: number;
  pneus: number;
  freins: number;
  carrosserie: number;
  transport: number;
  garantieVendue?: number;
  total: number;
}

export interface ScoreCarmelo {
  rentabilite: number;          // /100
  rotation: number;             // /100
  fiabilite: number;            // /100
  popularite: number;           // /100
  immobilisation: number;       // /100 (inverted — 100 = low risk)
  historiqueEntretien: number;  // /100
  risqueMecanique: number;      // /100 (inverted — 100 = safe)
  scoreTotal: number;           // /100 weighted average
}

export interface ScenariosMarge {
  pessimiste: number;   // buy at prix demande, no negotiation
  realiste: number;     // buy at prix probable after negotiation
  optimiste: number;    // buy at prix cible (ideal)
}

export interface RisqueMoteur {
  moteur: string;
  fiabilite: number;        // 1-5
  defautsConnus: string[];
  coutRisqueMoyen: number;
  niveauRisque: NiveauRisque;
  blacklisted: boolean;
}

export interface ScoreRotation {
  valeur: number;              // 1-10
  categorie: TypeRotation;
  delaiEstimeJours: number;
  facteurs: string[];
}

export interface ComparaisonVN {
  prixVNReference: number;
  ecartEuros: number;
  ecartPct: number;
  penalise: boolean;
  explication: string;
}

export interface CarmeloResult {
  vehicule: string;
  decision: DecisionVehicule;
  raisonRefus?: string;

  // Qualitative
  pointsForts: string[];
  pointsFaibles: string[];
  risquesMecaniques: RisqueMoteur[];
  risquesCommerciaux: string[];
  alertes: string[];
  coherenceKilometrage: string;

  // Prix calcules
  prixMarcheReel: number;
  prixVenteRealiste: number;
  prixAchatCible: number;
  prixAchatMaximum: number;
  prixAchatProbable: number;

  // Frais
  fraisDetail: FraisDetail;

  // Marges
  marges: ScenariosMarge;
  margeCible: number;
  zoneMarge: ZoneMarge;

  // Scores
  scoreRotation: ScoreRotation;
  scoreCapitalImmobilise: number;   // 1-10, 10 = most risky
  scoreRisqueMecanique: number;     // 1-10, 10 = most risky
  scoreCarmelo: ScoreCarmelo;

  // VN
  comparaisonVN?: ComparaisonVN;

  // Verdict
  coussinNegociation: number;
  margeCibleAtteinte: boolean;
  ecartPrixDemandePct: number;
  niveauConfiance: number;
  conclusion: string;
  actionRecommandee: string;
}
