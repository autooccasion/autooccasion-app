import { VehicleData } from '../types';

const NEUTRES = ['gris', 'gray', 'grey', 'blanc', 'white', 'noir', 'black', 'argent', 'silver', 'bleu marine', 'anthracite'];
const DIFFICILES = ['beige', 'jaune', 'yellow', 'violet', 'rose', 'pink', 'marron', 'brown'];
const SPORTIVES = ['rouge', 'red', 'orange'];

const MODELES_SPORTIFS = ['gti', 'type r', 's line', 'amg', 'm sport', 'st', 'rs', 'gr sport', 'coupe'];

function isModeleOuTypeSportif(data: VehicleData): boolean {
  if (data.typeVehicule === 'sportive') return true;
  const modele = data.modele.toLowerCase();
  const finition = (data.finition ?? '').toLowerCase();
  return MODELES_SPORTIFS.some(s => modele.includes(s) || finition.includes(s));
}

export interface CouleurAnalysis {
  penalite: boolean;
  scoreImpact: number;
  explication: string;
}

export function analyserCouleur(data: VehicleData): CouleurAnalysis {
  const c = data.couleur.toLowerCase();

  if (NEUTRES.some(n => c.includes(n))) {
    return {
      penalite: false,
      scoreImpact: 0,
      explication: `Couleur neutre (${data.couleur}) — pas de penalite rotation.`,
    };
  }

  if (DIFFICILES.some(d => c.includes(d))) {
    return {
      penalite: true,
      scoreImpact: -2,
      explication: `Couleur difficile (${data.couleur}) — penalite rotation importante.`,
    };
  }

  if (SPORTIVES.some(s => c.includes(s))) {
    if (isModeleOuTypeSportif(data)) {
      return {
        penalite: false,
        scoreImpact: 0,
        explication: `Couleur sportive (${data.couleur}) sur vehicule sportif — pas de penalite.`,
      };
    }
    return {
      penalite: true,
      scoreImpact: -1,
      explication: `Couleur sportive (${data.couleur}) sur vehicule non-sportif — penalite moderee.`,
    };
  }

  return {
    penalite: false,
    scoreImpact: -0.5,
    explication: `Couleur inconnue (${data.couleur}) — legere incertitude marche.`,
  };
}
