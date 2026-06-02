import { VehicleData, ScoreRotation, TypeRotation } from '../types';
import { CouleurAnalysis } from './couleur';

const MODELES_POPULAIRES = [
  'golf', 'polo', 'tiguan', 'stonic', 'tucson', 'yaris', 'corolla',
  'ceed', 'sportage', 'i30', 'i20',
];

function getCategorie(valeur: number): TypeRotation {
  if (valeur >= 9) return 'tres_rapide';
  if (valeur >= 7) return 'rapide';
  if (valeur >= 5) return 'moyenne';
  return 'lente';
}

function getDelai(categorie: TypeRotation): number {
  switch (categorie) {
    case 'tres_rapide': return 15;
    case 'rapide':      return 35;
    case 'moyenne':     return 65;
    case 'lente':       return 100;
  }
}

export function calculerRotation(data: VehicleData, couleurAnalysis: CouleurAnalysis): ScoreRotation {
  let score = 7;
  const facteurs: string[] = [];
  const marque  = data.marque.toLowerCase();
  const modele  = data.modele.toLowerCase();

  // Marque bonus
  if (['kia', 'hyundai', 'toyota'].some(m => marque.includes(m))) {
    score += 1;
    facteurs.push('Marque à forte demande (Kia/Hyundai/Toyota)');
  }

  if (['volkswagen', 'vw'].some(m => marque.includes(m)) || ['golf', 'polo'].some(m => modele.includes(m))) {
    score += 1;
    facteurs.push('Marque/modèle VW Group recherché');
  }

  // Modèle populaire
  if (MODELES_POPULAIRES.some(m => modele.includes(m))) {
    score += 1;
    facteurs.push(`Modèle populaire (${data.modele})`);
  }

  // Boîte
  if (data.boite === 'automatique') {
    score += 1;
    facteurs.push('Boîte automatique — forte demande');
  } else {
    score -= 1;
    facteurs.push('Boîte manuelle — demande plus faible');
  }

  // Couleur
  score += couleurAnalysis.scoreImpact;
  if (couleurAnalysis.scoreImpact < 0) {
    facteurs.push(couleurAnalysis.explication);
  }

  // Kilométrage
  if (data.kilometrage < 20000) {
    score += 2;
    facteurs.push('Kilométrage très bas (<20k)');
  } else if (data.kilometrage < 40000) {
    score += 1;
    facteurs.push('Kilométrage bas (<40k)');
  } else if (data.kilometrage > 60000) {
    score -= 1;
    facteurs.push('Kilométrage élevé (>60k)');
  }

  // Année
  if (data.annee >= 2024) {
    score += 1;
    facteurs.push('Véhicule très récent (≥2024)');
  } else if (data.annee <= 2021) {
    score -= 1;
    facteurs.push('Véhicule moins récent (≤2021)');
  }

  // Garantie
  if (data.garantieConstructeur) {
    score += 1;
    facteurs.push('Garantie constructeur restante');
  }

  // CT
  if (!data.ctValide) {
    score -= 0.5;
    facteurs.push('CT non valide');
  }

  const valeur = Math.round(Math.max(1, Math.min(10, score)));
  const categorie = getCategorie(valeur);
  const delaiEstimeJours = getDelai(categorie);

  return { valeur, categorie, delaiEstimeJours, facteurs };
}
