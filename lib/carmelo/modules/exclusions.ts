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

export function verifierExclusions(data: VehicleData): { exclu: boolean; raison?: string } {
  if (isPureTech(data)) {
    return {
      exclu: true,
      raison: 'Moteur PSA PureTech — exclusion absolue GP-CARS. Fiabilite insuffisante.',
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
