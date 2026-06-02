import { TypeRotation } from '../types';

export function calculerScoreCapital(
  prixAchatProbable: number,
  scoreRotation: { valeur: number; categorie: TypeRotation },
  scoreRisqueMecanique: number,
): number {
  let score = 1;

  // Prix
  if (prixAchatProbable > 20000) {
    score += 3;
  } else if (prixAchatProbable > 15000) {
    score += 2;
  } else if (prixAchatProbable > 10000) {
    score += 1;
  }

  // Rotation
  switch (scoreRotation.categorie) {
    case 'lente':       score += 3; break;
    case 'moyenne':     score += 2; break;
    case 'rapide':      score += 1; break;
    case 'tres_rapide': score += 0; break;
  }

  // Risque mécanique
  if (scoreRisqueMecanique >= 8) {
    score += 3;
  } else if (scoreRisqueMecanique >= 5) {
    score += 2;
  } else if (scoreRisqueMecanique >= 3) {
    score += 1;
  }

  return Math.max(1, Math.min(10, score));
}
