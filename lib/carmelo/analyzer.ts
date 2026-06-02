import { VehicleData, CarmeloResult, RisqueMoteur } from './types';
import { verifierExclusions }    from './modules/exclusions';
import { calculerFrais }         from './modules/frais';
import { getMargeCible, getMargeMin, calculerPrix, calculerScenarios, getZoneMarge } from './modules/marge';
import { analyserRisqueMecanique } from './modules/risque';
import { analyserCouleur }       from './modules/couleur';
import { calculerRotation }      from './modules/rotation';
import { calculerScoreCapital }  from './modules/capital';
import { comparerAvecVN }        from './modules/comparaison-vn';
import { calculerVerdict }       from './modules/verdict';

export { VehicleData, CarmeloResult } from './types';

// ─── Qualitative helper ────────────────────────────────────────────────────────

const MARQUES_PREFEREES = ['kia', 'hyundai', 'toyota', 'volkswagen', 'vw', 'audi', 'bmw', 'mercedes'];

function buildAnalyseQualitative(
  data: VehicleData,
  couleurAnalysis: ReturnType<typeof analyserCouleur>,
  scoreRisqueMecanique: number,
) {
  const pointsForts: string[] = [];
  const pointsFaibles: string[] = [];
  const risquesCommerciaux: string[] = [];

  // Points forts
  if (data.garantieConstructeur)  pointsForts.push('Garantie constructeur restante');
  if (data.entretienRecent)        pointsForts.push('Entretien récent documenté');
  if (data.boite === 'automatique') pointsForts.push('Boîte automatique — forte demande');
  if (data.carrosseriePropre)      pointsForts.push('Carrosserie sans défaut');
  if (data.kilometrage < 40000)    pointsForts.push('Kilométrage bas (<40k)');
  if (data.annee >= 2023)          pointsForts.push('Véhicule récent (≥2023)');
  if (data.ctValide)               pointsForts.push('CT valide — pas de frais');
  if (!couleurAnalysis.penalite)   pointsForts.push(`Couleur favorable (${data.couleur})`);
  if (scoreRisqueMecanique <= 2)   pointsForts.push('Moteur très fiable — risque mécanique minimal');
  if (MARQUES_PREFEREES.some(m => data.marque.toLowerCase().includes(m))) {
    pointsForts.push('Marque recherchée sur le marché belge');
  }

  // Points faibles
  if (!data.entretienRecent)   pointsFaibles.push('Entretien à prévoir — frais certains');
  if (!data.pneusOk)           pointsFaibles.push('Pneus à remplacer');
  if (!data.freinsOk)          pointsFaibles.push('Freins à vérifier/remplacer');
  if (!data.carrosseriePropre) pointsFaibles.push('Carrosserie à reprendre');
  if (couleurAnalysis.penalite) pointsFaibles.push(couleurAnalysis.explication);
  if (data.boite === 'manuelle') pointsFaibles.push('Boîte manuelle — demande plus faible');
  if (!data.garantieConstructeur) pointsFaibles.push('Hors garantie constructeur');
  if (data.kilometrage > 60000)  pointsFaibles.push('Kilométrage élevé (>60k)');

  // Risques commerciaux
  if (couleurAnalysis.penalite) {
    risquesCommerciaux.push(`Couleur peu recherchée (${data.couleur}) — délai de vente allongé`);
  }
  if (scoreRisqueMecanique >= 8) {
    risquesCommerciaux.push('Risque mécanique élevé — peut freiner la revente');
  }
  if (risquesCommerciaux.length === 0) {
    risquesCommerciaux.push('Aucun risque commercial majeur identifié');
  }

  // Cohérence kilométrage
  const kmParAn = data.kilometrage / Math.max(1, 2025 - data.annee);
  let coherenceKilometrage: string;
  if (kmParAn < 5000)  coherenceKilometrage = 'SUSPECT — kilométrage anormalement bas, vérifier historique';
  else if (kmParAn < 25000) coherenceKilometrage = 'OUI — kilométrage cohérent';
  else if (kmParAn < 35000) coherenceKilometrage = 'OUI — kilométrage légèrement élevé mais acceptable';
  else coherenceKilometrage = 'ÉLEVÉ — usage intensif, surveiller l\'état mécanique';

  // Niveau de confiance
  let niveauConfiance = 65;
  if (data.garantieConstructeur && data.entretienRecent) niveauConfiance += 15;
  if (data.carrosseriePropre && data.pneusOk)           niveauConfiance += 10;
  if (data.prixMarcheEstime === 0)                       niveauConfiance -= 20;
  if (scoreRisqueMecanique >= 8)                         niveauConfiance -= 15;
  niveauConfiance = Math.max(20, Math.min(95, niveauConfiance));

  return { pointsForts, pointsFaibles, risquesCommerciaux, coherenceKilometrage, niveauConfiance };
}

// ─── Refus builder ─────────────────────────────────────────────────────────────

function buildRefus(vehicule: string, raison: string): CarmeloResult {
  const emptyRisque: RisqueMoteur = {
    moteur: '—',
    fiabilite: 0,
    defautsConnus: [],
    coutRisqueMoyen: 0,
    niveauRisque: 'modere',
    blacklisted: false,
  };

  return {
    vehicule,
    decision: 'ROUGE',
    raisonRefus: raison,

    pointsForts: [],
    pointsFaibles: [],
    risquesMecaniques: [emptyRisque],
    risquesCommerciaux: [],
    alertes: [],
    coherenceKilometrage: '—',

    prixMarcheReel: 0,
    prixVenteRealiste: 0,
    prixAchatCible: 0,
    prixAchatMaximum: 0,
    prixAchatProbable: 0,

    fraisDetail: {
      ct: 0, preparation: 0, publicite: 0,
      entretien: 0, pneus: 0, freins: 0,
      carrosserie: 0, transport: 0, total: 0,
    },

    marges: { pessimiste: 0, realiste: 0, optimiste: 0 },
    margeCible: 0,
    zoneMarge: 'rouge',

    scoreRotation: { valeur: 0, categorie: 'lente', delaiEstimeJours: 0, facteurs: [] },
    scoreCapitalImmobilise: 0,
    scoreRisqueMecanique: 0,

    comparaisonVN: undefined,

    coussinNegociation: 0,
    margeCibleAtteinte: false,
    ecartPrixDemandePct: 0,
    niveauConfiance: 100,
    conclusion: raison,
    actionRecommandee: 'Passer. Ne pas contacter le vendeur.',
  };
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function analyzeVehicle(data: VehicleData): CarmeloResult {
  const vehicule = `${data.marque} ${data.modele} ${data.annee} / ${data.kilometrage.toLocaleString('fr')} km / ${data.motorisation}`;

  // 1. Exclusions
  const exclusion = verifierExclusions(data);
  if (exclusion.exclu) {
    return buildRefus(vehicule, exclusion.raison ?? 'Véhicule exclu.');
  }

  // 2. Frais
  const fraisDetail = calculerFrais(data);

  // 3. Marges & prix
  const margeCible = getMargeCible(data.prixMarcheEstime);
  const margeMin   = getMargeMin(data.prixMarcheEstime);
  const prix       = calculerPrix(data.prixMarcheEstime, fraisDetail.total, margeCible, margeMin);
  const { prixVenteRealiste, coussinNegociation, prixAchatCible, prixAchatMaximum, prixAchatProbable } = prix;

  const marges   = calculerScenarios(prixVenteRealiste, data.prixDemande, prixAchatProbable, prixAchatCible, fraisDetail.total, coussinNegociation);
  const zoneMarge = getZoneMarge(marges.pessimiste, data.prixMarcheEstime);

  // 4. Risque mécanique
  const { risques: risquesMecaniques, scoreMecanique: scoreRisqueMecanique } = analyserRisqueMecanique(data);

  // 5. Couleur
  const couleurAnalysis = analyserCouleur(data);

  // 6. Rotation
  const scoreRotation = calculerRotation(data, couleurAnalysis);

  // 7. Capital immobilisé
  const scoreCapitalImmobilise = calculerScoreCapital(prixAchatProbable, scoreRotation, scoreRisqueMecanique);

  // 8. Comparaison VN
  const comparaisonVN = comparerAvecVN(
    data.prixVNReference && data.prixVNReference > 0 ? data.prixVNReference : undefined,
    data.prixMarcheEstime,
  );

  // 9. Analyse qualitative
  const qualitative = buildAnalyseQualitative(data, couleurAnalysis, scoreRisqueMecanique);
  const margeCibleAtteinte = marges.pessimiste >= margeCible;

  // 10. Verdict
  const verdict = calculerVerdict({
    prixDemande: data.prixDemande,
    prixAchatMaximum,
    prixAchatCible,
    prixAchatProbable,
    zoneMarge,
    scoreRisqueMecanique,
    scoreCapitalImmobilise,
    scoreRotation,
    comparaisonVN,
    margeCibleAtteinte,
  });

  return {
    vehicule,
    decision: verdict.decision,

    pointsForts:  qualitative.pointsForts,
    pointsFaibles: qualitative.pointsFaibles,
    risquesMecaniques,
    risquesCommerciaux: qualitative.risquesCommerciaux,
    alertes: verdict.alertes,
    coherenceKilometrage: qualitative.coherenceKilometrage,

    prixMarcheReel:    data.prixMarcheEstime,
    prixVenteRealiste: Math.round(prixVenteRealiste),
    prixAchatCible,
    prixAchatMaximum,
    prixAchatProbable,

    fraisDetail,

    marges,
    margeCible,
    zoneMarge,

    scoreRotation,
    scoreCapitalImmobilise,
    scoreRisqueMecanique,

    comparaisonVN,

    coussinNegociation,
    margeCibleAtteinte,
    ecartPrixDemandePct: verdict.ecartPrixDemandePct,
    niveauConfiance:     qualitative.niveauConfiance,
    conclusion:          verdict.conclusion,
    actionRecommandee:   verdict.actionRecommandee,
  };
}
