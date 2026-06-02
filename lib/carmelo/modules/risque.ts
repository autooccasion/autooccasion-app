import { VehicleData, RisqueMoteur, NiveauRisque } from '../types';

interface MoteurEntry {
  nom: string;
  codes: string[];
  keywords: string[];
  marques: string[];           // empty = all marques
  fiabilite: number;
  defauts: string[];
  coutRisque: number;
  niveauRisque: NiveauRisque;
}

const MOTEUR_DB: MoteurEntry[] = [
  {
    nom: 'PSA PureTech',
    codes: ['eb2', 'eb2adt', 'eb2adts'],
    keywords: ['puretech', '1.2 puretech', '1.0 puretech'],
    marques: ['peugeot', 'citroen', 'ds', 'opel'],
    fiabilite: 1,
    defauts: [
      'Consommation huile excessive',
      'Chaine distribution fragile',
      'Piston/segment defectueux',
    ],
    coutRisque: 4000,
    niveauRisque: 'blacklist',
  },
  {
    nom: 'BMW N47',
    codes: ['n47'],
    keywords: ['n47', '318d', '320d 2.0d'],
    marques: ['bmw'],
    fiabilite: 2,
    defauts: [
      'Chaine distribution cote boite — casse catastrophique',
      'Remplacement chaine 2500–4000€',
      'Pompe a eau',
    ],
    coutRisque: 3500,
    niveauRisque: 'eleve',
  },
  {
    nom: 'BMW B47',
    codes: ['b47'],
    keywords: ['b47', '318d', '320d', '520d', '118d', '120d'],
    marques: ['bmw'],
    fiabilite: 3,
    defauts: ['EGR a surveiller > 100k', 'Couts reparation premium'],
    coutRisque: 2000,
    niveauRisque: 'modere',
  },
  {
    nom: 'Mercedes OM654',
    codes: ['om654'],
    keywords: ['om654', '200d', '220d', 'e220d', 'c220d'],
    marques: ['mercedes'],
    fiabilite: 4,
    defauts: ['FAP a haut km', 'Couts reparation premium'],
    coutRisque: 1500,
    niveauRisque: 'faible',
  },
  {
    nom: 'VW 1.5 TSI',
    codes: ['ea211'],
    keywords: ['1.5 tsi', '1.5tsi'],
    marques: ['volkswagen', 'vw', 'audi', 'skoda', 'seat'],
    fiabilite: 4,
    defauts: ['Legere consommation huile certaines versions'],
    coutRisque: 800,
    niveauRisque: 'faible',
  },
  {
    nom: 'VW 2.0 TDI',
    codes: [],
    keywords: ['2.0 tdi', '2.0tdi'],
    marques: ['volkswagen', 'vw', 'audi', 'skoda', 'seat'],
    fiabilite: 3,
    defauts: ['FAP/EGR >100k', 'Volant bi-masse', 'Pompe injection'],
    coutRisque: 1800,
    niveauRisque: 'modere',
  },
  {
    nom: 'Toyota Hybrid',
    codes: [],
    keywords: ['hybrid', 'hybride', 'yaris cross', 'corolla hybrid', 'rav4 hybrid'],
    marques: ['toyota', 'lexus'],
    fiabilite: 5,
    defauts: [
      'Batterie 15+ ans en conditions normales',
      'Remplacement 1500–3000€ si necessaire',
    ],
    coutRisque: 500,
    niveauRisque: 'excellent',
  },
  {
    nom: 'Kia/Hyundai essence',
    codes: [],
    keywords: ['1.0 t-gdi', '1.5 t-gdi', '1.6 t-gdi', 'smartstream'],
    marques: ['kia', 'hyundai'],
    fiabilite: 4,
    defauts: [
      '1.0 T-GDI premieres series: legere conso huile',
      'Garantie 7 ans avantageuse',
    ],
    coutRisque: 600,
    niveauRisque: 'faible',
  },
  {
    nom: 'Kia/Hyundai hybride',
    codes: [],
    keywords: ['1.6 hybrid', '1.6 gdi hybrid', 'hev'],
    marques: ['kia', 'hyundai'],
    fiabilite: 4,
    defauts: ['Technologie hybride eprouvee'],
    coutRisque: 700,
    niveauRisque: 'faible',
  },
  {
    nom: 'Renault 1.2 TCe',
    codes: [],
    keywords: ['1.2 tce', 'tce 115', 'tce 120', 'tce 130'],
    marques: ['renault', 'nissan', 'dacia'],
    fiabilite: 1,
    defauts: [
      'Chaîne distribution dans huile — casse fréquente',
      'Consommation huile excessive',
      'Coût réparation 3000-5000€',
    ],
    coutRisque: 4000,
    niveauRisque: 'blacklist',
  },
  {
    nom: 'Ford 1.0 EcoBoost (courroie humide)',
    codes: [],
    keywords: ['1.0 ecoboost', 'ecoboost 100', 'ecoboost 125', 'ecoboost 140'],
    marques: ['ford'],
    fiabilite: 2,
    defauts: [
      'Courroie distribution dans huile',
      'Casse courroie = moteur HS',
      'Versions <2018 à éviter absolument',
    ],
    coutRisque: 5000,
    niveauRisque: 'eleve',
  },
  {
    nom: 'Mercedes OM651',
    codes: ['om651'],
    keywords: ['2.1 cdi', '2.1cdi', '200cdi', '220cdi', '250cdi'],
    marques: ['mercedes'],
    fiabilite: 2,
    defauts: [
      'Swirl flaps — risque aspiration moteur',
      'Chaîne distribution fragile versions <2014',
      'Coût réparation swirl flaps 1500€',
    ],
    coutRisque: 2500,
    niveauRisque: 'eleve',
  },
  {
    nom: 'VW DSG DQ200 (7 vitesses sec)',
    codes: ['dq200'],
    keywords: ['dsg 7', '7-dsg', 'dq200', 's tronic 7'],
    marques: ['volkswagen', 'vw', 'audi', 'seat', 'skoda'],
    fiabilite: 2,
    defauts: [
      'Embrayage sec — à-coups fréquents',
      'Mécatronique défaillante versions <2015',
      'Remplacement mécatronique 1500-3000€',
    ],
    coutRisque: 2000,
    niveauRisque: 'eleve',
  },
];

const RISK_SCORE: Record<NiveauRisque, number> = {
  blacklist: 10,
  eleve: 8,
  modere: 5,
  faible: 2,
  excellent: 1,
};

function matchesEntry(entry: MoteurEntry, data: VehicleData): boolean {
  const mot = data.motorisation.toLowerCase();
  const code = (data.codeMoteur ?? '').toLowerCase();
  const marque = data.marque.toLowerCase();

  const codeMatch = entry.codes.some(c => code.includes(c));
  const keywordMatch = entry.keywords.some(k => mot.includes(k) || code.includes(k));

  if (!codeMatch && !keywordMatch) return false;

  if (entry.marques.length === 0) return true;
  return entry.marques.some(m => marque.includes(m));
}

function entryToRisque(entry: MoteurEntry): RisqueMoteur {
  return {
    moteur: entry.nom,
    fiabilite: entry.fiabilite,
    defautsConnus: entry.defauts,
    coutRisqueMoyen: entry.coutRisque,
    niveauRisque: entry.niveauRisque,
    blacklisted: entry.niveauRisque === 'blacklist',
  };
}

export function analyserRisqueMecanique(data: VehicleData): {
  risques: RisqueMoteur[];
  scoreMecanique: number;
} {
  const matches = MOTEUR_DB.filter(e => matchesEntry(e, data));

  if (matches.length === 0) {
    const unknown: RisqueMoteur = {
      moteur: 'Moteur non reference',
      fiabilite: 3,
      defautsConnus: ['Moteur non reference — verification manuelle recommandee'],
      coutRisqueMoyen: 1000,
      niveauRisque: 'modere',
      blacklisted: false,
    };
    return { risques: [unknown], scoreMecanique: RISK_SCORE['modere'] };
  }

  const risques = matches.map(entryToRisque);
  const worstScore = Math.max(...risques.map(r => RISK_SCORE[r.niveauRisque]));

  return { risques, scoreMecanique: worstScore };
}
