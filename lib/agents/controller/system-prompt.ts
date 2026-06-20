import { MARGES, GP_CARS_PARAMS, EXCLUSIONS_ABSOLUES } from '@/lib/carmelo/config';
import type { VehicleSummary, ControllerFlag } from '../shared-types';

export function buildControllerSystemPrompt(): string {
  return `Tu es l'Agent Contrôleur de GP-CARS.
Tu es le dernier rempart avant qu'une décision erronée coûte de l'argent au garage.

## MISSION
Vérifier les données soumises par l'Agent Achats et l'Agent Marketing.
Détecter incohérences, erreurs et violations des règles GP-CARS.
Bloquer ce qui doit l'être. Alerter pour ce qui nécessite validation humaine.

## CE QUE TU VÉRIFIES
1. **Marges** : la marge estimée est-elle cohérente avec le prix d'achat et le prix de vente ?
   Seuil standard : ≥ ${MARGES.standard.cible} € (< ${MARGES.standard.orange_min} € → BLOQUANT)
   Seuil premium : ≥ ${MARGES.premium.cible} € (< ${MARGES.premium.orange_min} € → BLOQUANT)

2. **Plafond d'achat** : prix d'achat ≤ ${GP_CARS_PARAMS.plafond_achat_vehicule.toLocaleString('fr-BE')} €.
   Dépassement → BLOQUANT.

3. **Cohérence km / année** : kilométrage incohérent avec l'année → AVERTISSEMENT ou BLOQUANT si évident.

4. **Exclusions absolues** :
${EXCLUSIONS_ABSOLUES.map((e) => `   - ${e}`).join('\n')}
   Si présent → BLOQUANT.

5. **Surstock** : si la même marque compte déjà ≥ 2 véhicules en stock (acheté/en_stock/publié) → AVERTISSEMENT (risque d'immobilisation concentrée).

6. **Trésorerie** : si le capital total engagé en stock approche ou dépasse le budget journalier (${GP_CARS_PARAMS.budget_max_jour.toLocaleString('fr-BE')} €) → AVERTISSEMENT ou BLOQUANT si dépassé.

7. **Annonce** : titre trop court (< 20 chars), description vide → AVERTISSEMENT.

8. **Prix de vente vs marché** : prix de vente > 120 % de la valeur de marché estimée → AVERTISSEMENT.

9. **Confiance** : si Carmelo a indiqué confiance < ${GP_CARS_PARAMS.seuil_confiance_autonome} % → VALIDATION HUMAINE REQUISE.

## FORMAT DE SORTIE OBLIGATOIRE
JSON strict sans markdown :
{
  "valide": true|false,
  "requires_human_validation": true|false,
  "flags": [
    { "code": "...", "severity": "bloquant|avertissement|info", "message": "..." }
  ],
  "summary": "1 phrase de synthèse"
}

valide = false si au moins un flag bloquant est présent.
requires_human_validation = true si confiance < ${GP_CARS_PARAMS.seuil_confiance_autonome}% ou si un flag bloquant non résolvable automatiquement est présent.`;
}

// Pure rule checks that don't need an LLM call — run these first to save API cost.
export function runHardRules(vehicle: VehicleSummary): ControllerFlag[] {
  const flags: ControllerFlag[] = [];

  if (vehicle.realBuyPrice != null && vehicle.realBuyPrice > GP_CARS_PARAMS.plafond_achat_vehicule) {
    flags.push({
      code: 'PLAFOND_ACHAT_DEPASSE',
      severity: 'bloquant',
      message: `Prix d'achat réel (${vehicle.realBuyPrice.toLocaleString('fr-BE')} €) dépasse le plafond GP-CARS (${GP_CARS_PARAMS.plafond_achat_vehicule.toLocaleString('fr-BE')} €).`,
    });
  }

  if (vehicle.maxBuyPrice != null && vehicle.askingPrice != null && vehicle.askingPrice > vehicle.maxBuyPrice) {
    flags.push({
      code: 'PRIX_ACHAT_DEPASSE_MAX',
      severity: 'bloquant',
      message: `Prix demandé (${vehicle.askingPrice.toLocaleString('fr-BE')} €) dépasse le prix d'achat max conseillé (${vehicle.maxBuyPrice.toLocaleString('fr-BE')} €).`,
    });
  }

  if (vehicle.realMargin != null) {
    const tier = (vehicle.realSellPrice || 0) >= 20000 ? 'premium' : 'standard';
    const seuil = MARGES[tier].orange_min;
    if (vehicle.realMargin < seuil) {
      flags.push({
        code: 'MARGE_INSUFFISANTE',
        severity: 'bloquant',
        message: `Marge réelle (${vehicle.realMargin.toLocaleString('fr-BE')} €) sous le seuil ${tier} (${seuil.toLocaleString('fr-BE')} €).`,
      });
    }
  }

  if (vehicle.km != null && vehicle.year != null) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - vehicle.year;
    const avgKmPerYear = age > 0 ? vehicle.km / age : vehicle.km;
    if (avgKmPerYear > 50000) {
      flags.push({
        code: 'KM_SUSPECT',
        severity: 'avertissement',
        message: `Kilométrage suspect : ${Math.round(avgKmPerYear).toLocaleString('fr-BE')} km/an en moyenne (seuil : 50 000 km/an).`,
      });
    }
  }

  // RÈGLE: Confiance trop faible → validation humaine obligatoire
  if (vehicle.confidence != null && vehicle.confidence < 60) {
    flags.push({
      code: 'CONFIANCE_CRITIQUE',
      severity: 'bloquant',
      message: `Score de confiance Carmelo très bas (${vehicle.confidence}%) — données insuffisantes pour décider. Vérification manuelle obligatoire avant achat.`,
    });
  } else if (vehicle.confidence != null && vehicle.confidence < GP_CARS_PARAMS.seuil_confiance_autonome) {
    flags.push({
      code: 'CONFIANCE_FAIBLE',
      severity: 'avertissement',
      message: `Score de confiance Carmelo sous le seuil autonome (${vehicle.confidence}% < ${GP_CARS_PARAMS.seuil_confiance_autonome}%). Vérifier manuellement avant de conclure l'achat.`,
    });
  }

  // RÈGLE: Marge estimée insuffisante AVANT achat (check préventif)
  if (vehicle.estimatedMargin != null && vehicle.maxBuyPrice != null) {
    const sellPriceEstimate = (vehicle.maxBuyPrice ?? 0) + (vehicle.estimatedMargin ?? 0);
    const tier = sellPriceEstimate >= 20000 ? 'premium' : 'standard';
    const minMargin = MARGES[tier].orange_min;
    if (vehicle.estimatedMargin < minMargin) {
      flags.push({
        code: 'MARGE_ESTIMEE_INSUFFISANTE',
        severity: 'bloquant',
        message: `Marge estimée (${vehicle.estimatedMargin.toLocaleString('fr-BE')} €) inférieure au seuil ${tier} (${minMargin.toLocaleString('fr-BE')} €). Refuser cet achat.`,
      });
    }
  }

  // RÈGLE: Pas de price max calculé → décision impossible
  if (vehicle.maxBuyPrice == null && (vehicle.decision === 'VERT' || vehicle.decision === 'ORANGE')) {
    flags.push({
      code: 'PRIX_MAX_MANQUANT',
      severity: 'bloquant',
      message: `Décision positive (${vehicle.decision}) sans prix d'achat maximum calculé — analyse incomplète, ne pas acheter.`,
    });
  }

  return flags;
}
