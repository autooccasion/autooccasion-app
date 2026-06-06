import {
  DecisionVehicule,
  ZoneMarge,
  ScoreRotation,
  ComparaisonVN,
} from '../types';
import type { ActionRecommandee } from '../../agents/shared-types';

const SEUIL_ECART_ROUGE_PCT = 5;

export interface VerdictInput {
  prixDemande: number;
  prixAchatMaximum: number;
  prixAchatCible: number;
  prixAchatProbable: number;
  zoneMarge: ZoneMarge;
  scoreRisqueMecanique: number;
  scoreCapitalImmobilise: number;
  scoreRotation: ScoreRotation;
  comparaisonVN?: ComparaisonVN;
  margeCibleAtteinte: boolean;
}

export interface VerdictResult {
  decision: DecisionVehicule;
  alertes: string[];
  ecartPrixDemandePct: number;
  conclusion: string;
  actionRecommandee: ActionRecommandee;
  actionDetail: string;
}

export function calculerVerdict(input: VerdictInput): VerdictResult {
  const {
    prixDemande,
    prixAchatMaximum,
    prixAchatCible,
    prixAchatProbable,
    zoneMarge,
    scoreRisqueMecanique,
    scoreCapitalImmobilise,
    scoreRotation,
    comparaisonVN,
  } = input;

  // Écart prix demandé vs maximum acceptable
  const ecartPrixDemandePct =
    prixAchatMaximum > 0
      ? Math.round(((prixDemande - prixAchatMaximum) / prixAchatMaximum) * 100)
      : 0;

  // Build alertes
  const alertes: string[] = [];
  let penalites = 0;

  if (comparaisonVN?.penalise) {
    alertes.push(`Concurrence VN : ${comparaisonVN.explication}`);
    penalites += 2;
  }

  if (scoreRisqueMecanique >= 8) {
    alertes.push('Risque mécanique ÉLEVÉ — coût de réparation potentiel important.');
    penalites += 2;
  } else if (scoreRisqueMecanique >= 5) {
    alertes.push('Risque mécanique modéré — surveiller à l\'inspection.');
    penalites += 1;
  }

  if (scoreCapitalImmobilise >= 8) {
    alertes.push('Capital immobilisé ÉLEVÉ — risque de trésorerie important.');
    penalites += 2;
  }

  if (scoreRotation.categorie === 'lente') {
    alertes.push('Rotation lente estimée — risque d\'immobilisation prolongée.');
    penalites += 2;
  }

  if (ecartPrixDemandePct > SEUIL_ECART_ROUGE_PCT) {
    alertes.push(
      `Prix demandé dépasse le maximum de ${ecartPrixDemandePct}% — négociation impérative.`,
    );
  }

  // Decision
  let decision: DecisionVehicule;

  const isRouge =
    zoneMarge === 'rouge' ||
    (zoneMarge === 'exceptionnelle' && scoreRotation.categorie === 'lente') ||
    (ecartPrixDemandePct > 5 && zoneMarge !== 'verte') ||
    (scoreRisqueMecanique >= 8 && zoneMarge !== 'verte') ||
    (comparaisonVN !== undefined && comparaisonVN.ecartPct < 5);

  const isOr =
    !isRouge &&
    zoneMarge === 'exceptionnelle' &&
    scoreRotation.valeur >= 8 &&
    scoreRisqueMecanique <= 3 &&
    penalites === 0;

  const isVert =
    !isRouge &&
    !isOr &&
    (zoneMarge === 'verte' || zoneMarge === 'orange') &&
    scoreRotation.valeur >= 7 &&
    scoreRisqueMecanique <= 5 &&
    penalites <= 1;

  if (isRouge) {
    decision = 'ROUGE';
  } else if (isOr) {
    decision = 'OR';
  } else if (isVert) {
    decision = 'VERT';
  } else {
    decision = 'ORANGE';
  }

  // Conclusion
  const zoneLabel = zoneMarge === 'verte' ? 'verte' : zoneMarge === 'orange' ? 'orange' : zoneMarge === 'exceptionnelle' ? 'exceptionnelle' : 'rouge';
  const rotLabel  = scoreRotation.categorie === 'tres_rapide' ? 'très rapide' : scoreRotation.categorie === 'rapide' ? 'rapide' : scoreRotation.categorie === 'moyenne' ? 'moyenne' : 'lente';

  let conclusion: string;
  if (decision === 'OR') {
    conclusion = `Opportunité prioritaire. Zone marge exceptionnelle — rotation ${rotLabel} estimée à ${scoreRotation.delaiEstimeJours} jours. Agir rapidement : proposer ${prixAchatCible.toLocaleString('fr')} €, maximum absolu ${prixAchatMaximum.toLocaleString('fr')} €.`;
  } else if (decision === 'VERT') {
    conclusion = `Bonne affaire. Zone marge ${zoneLabel} — rotation ${rotLabel} estimée à ${scoreRotation.delaiEstimeJours} jours. Acquérir si le prix demandé (${prixDemande.toLocaleString('fr')} €) est négociable à ${prixAchatCible.toLocaleString('fr')} € (cible) — maximum absolu ${prixAchatMaximum.toLocaleString('fr')} €.`;
  } else if (decision === 'ORANGE') {
    const isLente = scoreRotation.categorie === 'lente' || scoreRotation.categorie === 'moyenne';
    conclusion = isLente
      ? `Conditions acceptables mais rotation ${rotLabel} — risque d'immobilisation. Surveiller sans s'engager. Négocier à ${prixAchatProbable.toLocaleString('fr')} €, ne pas dépasser ${prixAchatMaximum.toLocaleString('fr')} €.`
      : `Véhicule potentiellement intéressant mais marge limite. Zone ${zoneLabel} — rotation ${rotLabel}. Négocier à ${prixAchatProbable.toLocaleString('fr')} €, ne pas dépasser ${prixAchatMaximum.toLocaleString('fr')} €.`;
  } else {
    conclusion = `Dossier refusé. Zone marge ${zoneLabel}${ecartPrixDemandePct > 5 ? ` — prix demandé excède le maximum de ${ecartPrixDemandePct}%` : ''}. Passer au véhicule suivant.`;
  }

  // 4-tier action classification
  let actionRecommandee: ActionRecommandee;
  let actionDetail: string;

  if (decision === 'OR') {
    actionRecommandee = 'ACHETER';
    actionDetail = `🥇 PRIORITAIRE — Contacter immédiatement. Proposer ${prixAchatCible.toLocaleString('fr')} € — maximum ${prixAchatMaximum.toLocaleString('fr')} €. Validation GP-CARS requise avant engagement.`;
  } else if (decision === 'VERT') {
    actionRecommandee = 'ACHETER';
    actionDetail = `Contacter le vendeur. Proposer ${prixAchatCible.toLocaleString('fr')} € — maximum absolu ${prixAchatMaximum.toLocaleString('fr')} €. Validation GP-CARS requise.`;
  } else if (decision === 'ORANGE') {
    const isLente = scoreRotation.categorie === 'lente' || scoreRotation.categorie === 'moyenne';
    if (isLente) {
      actionRecommandee = 'SURVEILLER';
      actionDetail = `Mettre en veille. Réévaluer si le prix baisse sous ${prixAchatMaximum.toLocaleString('fr')} €.`;
    } else {
      actionRecommandee = 'NÉGOCIER';
      actionDetail = `Tenter négociation à ${prixAchatProbable.toLocaleString('fr')} €. Ne pas dépasser ${prixAchatMaximum.toLocaleString('fr')} €. Validation GP-CARS requise.`;
    }
  } else {
    actionRecommandee = 'REJETER';
    actionDetail = 'Ne pas contacter le vendeur. Passer au dossier suivant.';
  }

  return { decision, alertes, ecartPrixDemandePct, conclusion, actionRecommandee, actionDetail };
}
