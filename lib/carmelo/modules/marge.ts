import { ZoneMarge, ScenariosMarge } from '../types';

interface MargeThresholds {
  cible: number;
  min: number;
  exceptionnelle: number;
}

function getThresholds(prixMarcheEstime: number): MargeThresholds {
  if (prixMarcheEstime < 20000) {
    return { cible: 3000, min: 2500, exceptionnelle: 2200 };
  }
  if (prixMarcheEstime <= 30000) {
    return { cible: 4000, min: 3500, exceptionnelle: 3000 };
  }
  return { cible: 4500, min: 4000, exceptionnelle: 3500 };
}

export function getMargeCible(prixMarcheEstime: number): number {
  return getThresholds(prixMarcheEstime).cible;
}

export interface PrixCalcules {
  prixVenteRealiste: number;
  coussinNegociation: number;
  prixAchatCible: number;
  prixAchatMaximum: number;
  prixAchatProbable: number;
}

export function calculerPrix(
  prixMarcheEstime: number,
  fraisTotal: number,
  margeCible: number,
  margeMin: number,
): PrixCalcules {
  const prixVenteRealiste = prixMarcheEstime * 0.97;
  const coussinNegociation = Math.round(prixVenteRealiste * 0.03);
  const prixAchatCible = Math.round(prixVenteRealiste - margeCible - fraisTotal - coussinNegociation);
  const prixAchatMaximum = Math.round(prixVenteRealiste - margeMin - fraisTotal - coussinNegociation);
  const prixAchatProbable = Math.round((prixAchatCible + prixAchatMaximum) / 2);

  return { prixVenteRealiste, coussinNegociation, prixAchatCible, prixAchatMaximum, prixAchatProbable };
}

export function calculerScenarios(
  prixVenteRealiste: number,
  prixDemande: number,
  prixAchatProbable: number,
  prixAchatCible: number,
  fraisTotal: number,
  coussinNegociation: number,
): ScenariosMarge {
  const pessimiste = Math.round(prixVenteRealiste - prixDemande - fraisTotal - coussinNegociation);
  const realiste = Math.round(prixVenteRealiste - prixAchatProbable - fraisTotal - coussinNegociation);
  const optimiste = Math.round(prixVenteRealiste - prixAchatCible - fraisTotal - coussinNegociation);
  return { pessimiste, realiste, optimiste };
}

export function getZoneMarge(margePessimiste: number, prixMarcheEstime: number): ZoneMarge {
  const { cible, min, exceptionnelle } = getThresholds(prixMarcheEstime);
  if (margePessimiste >= cible) return 'verte';
  if (margePessimiste >= min) return 'orange';
  if (margePessimiste >= exceptionnelle) return 'exceptionnelle';
  return 'rouge';
}

export function getMargeMin(prixMarcheEstime: number): number {
  return getThresholds(prixMarcheEstime).min;
}
