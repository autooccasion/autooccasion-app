export interface VehicleData {
  marque: string;
  modele: string;
  annee: number;
  kilometrage: number;
  motorisation: string;
  boite: 'manuelle' | 'automatique';
  couleur: string;
  prixDemande: number;
  prixMarcheEstime: number;
  entretienRecent: boolean;
  pneusOk: boolean;
  freinsOk: boolean;
  carrosseriePropre: boolean;
  garantieConstructeur: boolean;
  ctValide: boolean;
  distanceKm: number;
  devisCarrosserie: number;
}

export interface CarmeloResult {
  vehicule: string;
  decision: 'VERT' | 'ORANGE' | 'ROUGE';
  raisonRefus: string;
  pointsForts: string[];
  pointsFaibles: string[];
  risquesMecaniques: string[];
  risquesCommerciaux: string[];
  coherenceKilometrage: string;
  prixMarcheReel: number;
  prixVenteRealiste: number;
  fraisCT: number;
  fraisPreparation: number;
  fraisPublicite: number;
  fraisEntretien: number;
  fraisPneus: number;
  fraisTransport: number;
  fraisGarantie: number;
  fraisCarrosserie: number;
  fraisTotal: number;
  coussinNegociation: number;
  margeCible: number;
  prixMaximum: number;
  margeEstimee: number;
  zoneMarge: 'verte' | 'orange' | 'rouge';
  scoreRotation: number;
  rotationJours: number;
  niveauConfiance: number;
  conclusion: string;
}

const MARQUES_PREFEREES = ['kia', 'hyundai', 'toyota', 'volkswagen', 'vw', 'audi', 'bmw', 'mercedes'];
const COULEURS_DIFFICILES = ['rouge', 'red', 'beige', 'orange', 'jaune', 'yellow', 'vert', 'green', 'violet', 'rose', 'pink'];

function isPureTech(motorisation: string): boolean {
  const m = motorisation.toLowerCase();
  return m.includes('puretech') || (m.includes('1.0') && m.includes('psa')) || (m.includes('1.2') && m.includes('psa'));
}

function isCouleurDifficile(couleur: string): boolean {
  const c = couleur.toLowerCase();
  return COULEURS_DIFFICILES.some(d => c.includes(d));
}

function getRotationScore(data: VehicleData): number {
  let score = 7;
  const marque = data.marque.toLowerCase();

  if (['kia', 'hyundai', 'toyota'].some(m => marque.includes(m))) score += 1;
  if (['volkswagen', 'vw', 'golf', 'polo'].some(m => marque.includes(m) || data.modele.toLowerCase().includes(m))) score += 1;
  if (['bmw', 'mercedes', 'audi'].some(m => marque.includes(m))) score += 0;

  if (data.boite === 'automatique') score += 1;
  if (data.boite === 'manuelle') score -= 1;

  if (isCouleurDifficile(data.couleur)) score -= 2;

  if (data.kilometrage < 30000) score += 1;
  if (data.kilometrage > 60000) score -= 1;

  if (data.annee >= 2023) score += 1;
  if (data.annee <= 2021) score -= 1;

  if (data.garantieConstructeur) score += 1;

  return Math.max(1, Math.min(10, score));
}

function getRotationJours(score: number): number {
  if (score >= 9) return 20;
  if (score >= 7) return 45;
  if (score >= 5) return 75;
  return 100;
}

function calculerFrais(data: VehicleData) {
  const ct = data.ctValide ? 0 : 105;
  const preparation = 100;
  const publicite = 200;
  const entretien = data.entretienRecent ? 0 : 250;
  const pneus = data.pneusOk ? 0 : 450;
  const freins = data.freinsOk ? 0 : 0; // inclus dans entretien
  const transport = data.distanceKm < 50 ? 0 : data.distanceKm < 200 ? 150 : 350;
  const garantie = data.garantieConstructeur ? 0 : 400;
  const carrosserie = data.carrosseriePropre ? 0 : data.devisCarrosserie;
  const total = ct + preparation + publicite + entretien + pneus + transport + garantie + carrosserie;
  return { ct, preparation, publicite, entretien, pneus, transport, garantie, carrosserie, total };
}

function getMargeCible(prixVente: number): number {
  return prixVente >= 25000 ? 4000 : 3000;
}

export function analyzeVehicle(data: VehicleData): CarmeloResult {
  const vehicule = `${data.marque} ${data.modele} ${data.annee} / ${data.kilometrage.toLocaleString('fr')} km / ${data.motorisation}`;

  // — Exclusions absolues —
  if (isPureTech(data.motorisation)) {
    return refus(vehicule, 'Moteur PSA PureTech — exclusion absolue GP-CARS. Fiabilité insuffisante.', data);
  }
  if (data.annee < 2021) {
    return refus(vehicule, `Véhicule trop ancien (${data.annee}) — critère minimum 2021.`, data);
  }
  if (data.kilometrage > 80000) {
    return refus(vehicule, `Kilométrage trop élevé (${data.kilometrage.toLocaleString('fr')} km) — maximum 80 000 km.`, data);
  }

  const frais = calculerFrais(data);
  const prixVenteRealiste = data.prixMarcheEstime * 0.97;
  const margeCible = getMargeCible(prixVenteRealiste);
  const coussin = Math.round(prixVenteRealiste * 0.03);
  const prixMaximum = Math.round(prixVenteRealiste - margeCible - frais.total - coussin);
  const margeEstimee = prixVenteRealiste - data.prixDemande - frais.total - coussin;
  const scoreRotation = getRotationScore(data);
  const rotationJours = getRotationJours(scoreRotation);

  const pointsForts: string[] = [];
  const pointsFaibles: string[] = [];
  const risquesMecaniques: string[] = [];
  const risquesCommerciaux: string[] = [];

  // Points forts
  if (data.garantieConstructeur) pointsForts.push('Garantie constructeur restante');
  if (data.entretienRecent) pointsForts.push('Entretien récent documenté');
  if (data.boite === 'automatique') pointsForts.push('Boîte automatique — forte demande');
  if (data.carrosseriePropre) pointsForts.push('Carrosserie sans défaut');
  if (data.kilometrage < 40000) pointsForts.push('Kilométrage bas');
  if (data.annee >= 2023) pointsForts.push('Véhicule récent');
  if (data.ctValide) pointsForts.push('CT valide — pas de frais');
  if (MARQUES_PREFEREES.some(m => data.marque.toLowerCase().includes(m))) pointsForts.push('Marque recherchée sur le marché belge');

  // Points faibles
  if (!data.entretienRecent) pointsFaibles.push('Entretien à prévoir — frais certains');
  if (!data.pneusOk) pointsFaibles.push('Pneus à remplacer');
  if (!data.carrosseriePropre) pointsFaibles.push('Carrosserie à reprendre');
  if (isCouleurDifficile(data.couleur)) pointsFaibles.push(`Couleur difficile (${data.couleur}) — délai de vente allongé`);
  if (data.boite === 'manuelle') pointsFaibles.push('Boîte manuelle — demande plus faible');
  if (!data.garantieConstructeur) pointsFaibles.push('Hors garantie constructeur');
  if (data.kilometrage > 60000) pointsFaibles.push('Kilométrage élevé');

  // Risques mécaniques
  const mot = data.motorisation.toLowerCase();
  if (mot.includes('1.0') || mot.includes('1.2')) risquesMecaniques.push('Petit moteur — surveiller turbo et chaîne');
  if (mot.includes('diesel') && data.kilometrage > 50000) risquesMecaniques.push('Diesel > 50 000 km — surveiller FAP et injection');
  if (data.marque.toLowerCase().includes('bmw') || data.marque.toLowerCase().includes('mercedes')) {
    risquesMecaniques.push('Marque premium — coûts de réparation élevés hors garantie');
  }
  if (risquesMecaniques.length === 0) risquesMecaniques.push('Aucun risque mécanique majeur identifié');

  // Risques commerciaux
  if (isCouleurDifficile(data.couleur)) risquesCommerciaux.push('Couleur peu recherchée — immobilisation probable');
  if (scoreRotation < 6) risquesCommerciaux.push('Rotation lente estimée — risque d\'immobilisation');
  if (data.prixDemande > prixMaximum) risquesCommerciaux.push('Prix demandé supérieur au maximum — négociation impérative');
  if (risquesCommerciaux.length === 0) risquesCommerciaux.push('Aucun risque commercial majeur identifié');

  // Cohérence kilométrage
  const kmParAn = data.kilometrage / Math.max(1, 2025 - data.annee);
  let coherence = '';
  if (kmParAn < 5000) coherence = 'SUSPECT — kilométrage anormalement bas, vérifier historique';
  else if (kmParAn < 25000) coherence = 'OUI — kilométrage cohérent';
  else if (kmParAn < 35000) coherence = 'OUI — kilométrage légèrement élevé mais acceptable';
  else coherence = 'ÉLEVÉ — usage intensif, surveiller l\'état mécanique';

  // Zone marge et verdict
  let zoneMarge: 'verte' | 'orange' | 'rouge';
  let decision: 'VERT' | 'ORANGE' | 'ROUGE';
  let conclusion = '';
  let niveauConfiance = 70;

  if (data.garantieConstructeur && data.entretienRecent) niveauConfiance += 15;
  if (data.carrosseriePropre && data.pneusOk) niveauConfiance += 10;
  if (data.prixMarcheEstime === 0) niveauConfiance -= 20;

  if (margeEstimee >= margeCible) {
    zoneMarge = 'verte';
  } else if (margeEstimee >= margeCible * 0.85) {
    zoneMarge = 'orange';
  } else {
    zoneMarge = 'rouge';
  }

  if (zoneMarge === 'verte' && scoreRotation >= 6) {
    decision = 'VERT';
    conclusion = `Bonne affaire. Marge en zone verte (${Math.round(margeEstimee).toLocaleString('fr')} €) avec rotation estimée à ${rotationJours} jours. Acquérir si le prix demandé (${data.prixDemande.toLocaleString('fr')} €) est négociable à ${prixMaximum.toLocaleString('fr')} € maximum.`;
  } else if (zoneMarge === 'orange' && scoreRotation >= 7) {
    decision = 'ORANGE';
    conclusion = `Véhicule intéressant mais marge limite (${Math.round(margeEstimee).toLocaleString('fr')} €). Acceptable uniquement si négociation jusqu'à ${prixMaximum.toLocaleString('fr')} € et rotation confirmée rapide.`;
  } else if (data.prixDemande > prixMaximum) {
    decision = 'ORANGE';
    conclusion = `Prix demandé (${data.prixDemande.toLocaleString('fr')} €) trop élevé. Négocier impérativement à ${prixMaximum.toLocaleString('fr')} € maximum pour atteindre la marge cible.`;
  } else {
    decision = 'ROUGE';
    conclusion = `Marge insuffisante (${Math.round(margeEstimee).toLocaleString('fr')} €) — en dessous du seuil GP-CARS. Passer au suivant ou faire une offre très basse.`;
  }

  return {
    vehicule,
    decision,
    raisonRefus: '',
    pointsForts,
    pointsFaibles,
    risquesMecaniques,
    risquesCommerciaux,
    coherenceKilometrage: coherence,
    prixMarcheReel: data.prixMarcheEstime,
    prixVenteRealiste: Math.round(prixVenteRealiste),
    fraisCT: frais.ct,
    fraisPreparation: frais.preparation,
    fraisPublicite: frais.publicite,
    fraisEntretien: frais.entretien,
    fraisPneus: frais.pneus,
    fraisTransport: frais.transport,
    fraisGarantie: frais.garantie,
    fraisCarrosserie: frais.carrosserie,
    fraisTotal: frais.total,
    coussinNegociation: coussin,
    margeCible,
    prixMaximum,
    margeEstimee: Math.round(margeEstimee),
    zoneMarge,
    scoreRotation,
    rotationJours,
    niveauConfiance: Math.min(95, niveauConfiance),
    conclusion,
  };
}

function refus(vehicule: string, raison: string, data: VehicleData): CarmeloResult {
  return {
    vehicule,
    decision: 'ROUGE',
    raisonRefus: raison,
    pointsForts: [],
    pointsFaibles: [],
    risquesMecaniques: [],
    risquesCommerciaux: [],
    coherenceKilometrage: '—',
    prixMarcheReel: 0,
    prixVenteRealiste: 0,
    fraisCT: 0,
    fraisPreparation: 0,
    fraisPublicite: 0,
    fraisEntretien: 0,
    fraisPneus: 0,
    fraisTransport: 0,
    fraisGarantie: 0,
    fraisCarrosserie: 0,
    fraisTotal: 0,
    coussinNegociation: 0,
    margeCible: 0,
    prixMaximum: 0,
    margeEstimee: 0,
    zoneMarge: 'rouge',
    scoreRotation: 0,
    rotationJours: 0,
    niveauConfiance: 100,
    conclusion: raison,
  };
}
