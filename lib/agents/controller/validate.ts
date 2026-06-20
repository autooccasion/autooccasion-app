// Pre-analysis validation — runs BEFORE Claude API call to block obvious errors early.

import { GP_CARS_PARAMS } from '@/lib/carmelo/config';

export interface PreValidationResult {
  ok: boolean;
  blocking: string[];
  warnings: string[];
}

/**
 * Validates raw listing data before sending to Claude.
 * Returns blocking errors that prevent analysis entirely,
 * and warnings that are injected as context.
 */
export function preValidateListing(opts: {
  listingUrl: string;
  listingText: string;
  scrapedAt?: Date;
  comparablesCount?: number;
  askingPrice?: number;
}): PreValidationResult {
  const blocking: string[] = [];
  const warnings: string[] = [];

  // 1. Listing text must have minimum content
  if (!opts.listingText || opts.listingText.trim().length < 100) {
    blocking.push('Contenu de l\'annonce insuffisant pour analyse — texte trop court ou vide.');
  }

  // 2. Data freshness — warn if scraped more than 48h ago
  if (opts.scrapedAt) {
    const ageMs = Date.now() - opts.scrapedAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours > 48) {
      warnings.push(`⚠️ FRAÎCHEUR DES DONNÉES : annonce scrapée il y a ${Math.round(ageHours)}h. Vérifier que le véhicule est toujours disponible avant de faire une offre.`);
    } else if (ageHours > 24) {
      warnings.push(`⚠️ Données vieilles de ${Math.round(ageHours)}h — vérifier disponibilité.`);
    }
  }

  // 3. Insufficient comparables → confidence will be low
  if (opts.comparablesCount !== undefined && opts.comparablesCount < 5) {
    warnings.push(`⚠️ DONNÉES DE MARCHÉ LIMITÉES : seulement ${opts.comparablesCount} véhicule(s) comparable(s) trouvé(s). Le prix de marché estimé est peu fiable. Score de confiance réduit automatiquement.`);
    if (opts.comparablesCount === 0) {
      blocking.push('Aucun comparable trouvé — impossible d\'estimer le prix de marché. Analyse bloquée.');
    }
  }

  // 4. Asking price sanity check
  if (opts.askingPrice !== undefined && opts.askingPrice > 0) {
    if (opts.askingPrice > GP_CARS_PARAMS.plafond_achat_vehicule * 1.5) {
      warnings.push(`⚠️ Prix demandé (${opts.askingPrice.toLocaleString('fr-BE')} €) très au-dessus du plafond GP-CARS (${GP_CARS_PARAMS.plafond_achat_vehicule.toLocaleString('fr-BE')} €).`);
    }
  }

  return {
    ok: blocking.length === 0,
    blocking,
    warnings,
  };
}

/**
 * Calculates an adjusted confidence score based on data quality.
 * Base confidence comes from Claude, then we apply penalties.
 */
export function adjustConfidenceScore(
  baseConfidence: number,
  opts: {
    comparablesCount?: number;
    dataAgeHours?: number;
    hasVinCheck?: boolean;
    hasPriceHistory?: boolean;
  },
): number {
  let score = baseConfidence;

  // Penalty for few comparables
  if (opts.comparablesCount !== undefined) {
    if (opts.comparablesCount < 3) score -= 20;
    else if (opts.comparablesCount < 5) score -= 10;
    else if (opts.comparablesCount >= 10) score += 5; // bonus for rich data
  }

  // Penalty for old data
  if (opts.dataAgeHours !== undefined) {
    if (opts.dataAgeHours > 48) score -= 15;
    else if (opts.dataAgeHours > 24) score -= 5;
  }

  // Bonus for additional data sources
  if (opts.hasVinCheck) score += 10;
  if (opts.hasPriceHistory) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}
