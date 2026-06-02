import { VehicleData, ScoreCarmelo, ScoreRotation } from '../types';

export function calculerScoreCarmelo(
  data: VehicleData,
  margeRealiste: number,          // actual realistic margin in euros
  prixAchatProbable: number,
  scoreRotation: ScoreRotation,
  scoreRisqueMecanique: number,   // 1-10 (10=most risky)
  scoreCapitalImmobilise: number, // 1-10 (10=most risky)
): ScoreCarmelo {

  // 1. Rentabilité /100 — margin as % of purchase price
  const margePercent = prixAchatProbable > 0 ? (margeRealiste / prixAchatProbable) * 100 : 0;
  const rentabilite = Math.round(Math.min(100, Math.max(0,
    margePercent >= 25 ? 100 :
    margePercent >= 20 ? 90 :
    margePercent >= 15 ? 75 :
    margePercent >= 10 ? 55 :
    margePercent >= 5  ? 30 :
    0
  )));

  // 2. Rotation /100 — convert 1-10 score to 0-100
  const rotation = Math.round(Math.min(100, Math.max(0, (scoreRotation.valeur / 10) * 100)));

  // 3. Fiabilité /100 — inverted risk (10=blacklist → 0, 1=excellent → 100)
  const fiabilite = Math.round(Math.min(100, Math.max(0, ((10 - scoreRisqueMecanique) / 9) * 100)));

  // 4. Popularité /100 — based on make/model/type
  const marque = data.marque.toLowerCase();
  const modele = data.modele.toLowerCase();
  let popularite = 50; // base
  if (['kia', 'hyundai', 'toyota'].some(m => marque.includes(m))) popularite += 25;
  else if (['volkswagen', 'vw', 'audi', 'bmw', 'mercedes'].some(m => marque.includes(m))) popularite += 20;
  else if (['ford', 'renault', 'peugeot', 'opel'].some(m => marque.includes(m))) popularite += 10;
  if (['golf', 'polo', 'stonic', 'tucson', 'sportage', 'yaris', 'corolla', 'ceed', 'i30', 'i20'].some(m => modele.includes(m))) popularite += 15;
  if (data.boite === 'automatique') popularite += 10;
  if (['suv', 'citadine'].includes(data.typeVehicule)) popularite += 5;
  popularite = Math.round(Math.min(100, Math.max(0, popularite)));

  // 5. Immobilisation /100 — inverted capital risk (10=high risk → 0, 1=low risk → 100)
  const immobilisation = Math.round(Math.min(100, Math.max(0, ((10 - scoreCapitalImmobilise) / 9) * 100)));

  // 6. Historique entretien /100
  let historiqueEntretien = 50;
  if (data.entretienRecent) historiqueEntretien += 20;
  if (data.garantieConstructeur) historiqueEntretien += 20;
  if (data.ctValide) historiqueEntretien += 10;
  if (data.kilometrage < 30000) historiqueEntretien += 10;
  else if (data.kilometrage > 60000) historiqueEntretien -= 10;
  historiqueEntretien = Math.round(Math.min(100, Math.max(0, historiqueEntretien)));

  // 7. Risque mécanique /100 — same as fiabilité but separate dimension
  const risqueMecanique = fiabilite;

  // Weighted average
  const scoreTotal = Math.round(
    rentabilite         * 0.25 +
    rotation            * 0.20 +
    fiabilite           * 0.20 +
    popularite          * 0.10 +
    immobilisation      * 0.10 +
    historiqueEntretien * 0.10 +
    risqueMecanique     * 0.05
  );

  return {
    rentabilite,
    rotation,
    fiabilite,
    popularite,
    immobilisation,
    historiqueEntretien,
    risqueMecanique,
    scoreTotal,
  };
}
