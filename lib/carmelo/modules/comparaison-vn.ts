import { ComparaisonVN } from '../types';

export function comparerAvecVN(
  prixVNReference: number | undefined,
  prixMarcheReel: number,
): ComparaisonVN | undefined {
  if (!prixVNReference || prixVNReference <= 0) return undefined;

  const ecartEuros = prixVNReference - prixMarcheReel;
  const ecartPct   = Math.round((ecartEuros / prixVNReference) * 100);
  const penalise   = ecartPct < 15;

  let explication: string;
  if (ecartPct < 5) {
    explication = `CRITIQUE : VO à ${ecartPct}% du VN remisé. Acheteur rationnel choisira le neuf.`;
  } else if (ecartPct < 10) {
    explication = `RISQUE : VO à ${ecartPct}% du VN. Argumentaire de vente difficile.`;
  } else if (ecartPct < 15) {
    explication = `Attention : écart VN/VO réduit (${ecartPct}%). Pression prix probable.`;
  } else {
    explication = `Écart VN/VO confortable (${ecartPct}%) — pas de concurrence du neuf.`;
  }

  return { prixVNReference, ecartEuros, ecartPct, penalise, explication };
}
