import { VehicleData } from '../types';

const PURETECH_KEYWORDS = ['puretech', 'pure tech', 'eb2', 'eb2adt', 'eb2adts', 'eb2dts', '1.0 puretech', '1.2 puretech'];
const PURETECH_MARQUES = ['peugeot', 'citroën', 'citroen', 'ds', 'opel'];

function isPureTech(data: VehicleData): boolean {
  const mot = data.motorisation.toLowerCase();
  const marque = data.marque.toLowerCase();
  const code = (data.codeMoteur ?? '').toLowerCase();

  const keywordMatch = PURETECH_KEYWORDS.some(k => mot.includes(k) || code.includes(k));
  if (keywordMatch) return true;

  const marqueMatch = PURETECH_MARQUES.some(m => marque.includes(m));
  if (marqueMatch && (mot.includes('1.0') || mot.includes('1.2'))) return true;

  return false;
}

const RENAULT_TCE_KEYWORDS = ['1.2 tce', 'tce 115', 'tce 120', 'tce 130'];
const RENAULT_TCE_MARQUES = ['renault', 'nissan', 'dacia'];

function isRenaultTCe(data: VehicleData): boolean {
  const mot = data.motorisation.toLowerCase();
  const marque = data.marque.toLowerCase();
  const code = (data.codeMoteur ?? '').toLowerCase();

  const keywordMatch = RENAULT_TCE_KEYWORDS.some(k => mot.includes(k) || code.includes(k));
  if (!keywordMatch) return false;

  return RENAULT_TCE_MARQUES.some(m => marque.includes(m));
}

const FORD_ECOBOOST_KEYWORDS = ['1.0 ecoboost', 'ecoboost 100', 'ecoboost 125', 'ecoboost 140'];

function isFordEcoBoostWetBelt(data: VehicleData): boolean {
  const mot = data.motorisation.toLowerCase();
  const marque = data.marque.toLowerCase();
  const code = (data.codeMoteur ?? '').toLowerCase();

  if (!marque.includes('ford')) return false;

  const keywordMatch = FORD_ECOBOOST_KEYWORDS.some(k => mot.includes(k) || code.includes(k));
  return keywordMatch;
}

export function verifierExclusions(data: VehicleData): { exclu: boolean; raison?: string } {
  if (isPureTech(data)) {
    return {
      exclu: true,
      raison: 'Moteur PSA PureTech — exclusion absolue GP-CARS. Fiabilite insuffisante.',
    };
  }

  if (isRenaultTCe(data)) {
    return {
      exclu: true,
      raison: 'Moteur Renault 1.2 TCe — exclusion absolue GP-CARS. Chaine distribution dans huile, casse frequente, cout reparation 3000-5000€.',
    };
  }

  if (isFordEcoBoostWetBelt(data)) {
    return {
      exclu: true,
      raison: 'Moteur Ford 1.0 EcoBoost (courroie humide) — exclusion absolue GP-CARS. Courroie distribution dans huile, casse = moteur HS.',
    };
  }

  if (data.annee < 2021) {
    return {
      exclu: true,
      raison: `Vehicule trop ancien (${data.annee}) — critere minimum 2021.`,
    };
  }

  if (data.kilometrage > 80000) {
    return {
      exclu: true,
      raison: `Kilometrage trop eleve (${data.kilometrage.toLocaleString('fr')} km) — maximum 80 000 km.`,
    };
  }

  return { exclu: false };
}
