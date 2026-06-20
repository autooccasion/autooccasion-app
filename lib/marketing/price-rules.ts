// Marketing price reduction rules — applied automatically based on days in stock.

import type { VehicleRecord } from 'app/db';

export type PriceAction =
  | { action: 'none' }
  | { action: 'reduce'; amount: number; reason: string; daysInStock: number }
  | { action: 'alert'; reason: string; daysInStock: number }
  | { action: 'human_required'; reason: string; daysInStock: number };

/**
 * Returns the recommended price action for a vehicle based on time in stock.
 * Rules:
 *   J+14: if < 3 contacts → reduce by €300
 *   J+30: if still unsold → reduce by €500 + alert
 *   J+45: human decision required
 *   J+60: urgent intervention
 */
export function getPriceAction(vehicle: VehicleRecord): PriceAction {
  if (!vehicle.publishedAt) return { action: 'none' };

  const now = Date.now();
  const publishedMs = new Date(vehicle.publishedAt).getTime();
  const daysInStock = Math.floor((now - publishedMs) / (1000 * 60 * 60 * 24));

  if (daysInStock < 14) return { action: 'none' };

  if (daysInStock >= 60) {
    return {
      action: 'human_required',
      reason: `${daysInStock} jours en stock — décision urgente requise (reprise / bradage / transfert).`,
      daysInStock,
    };
  }

  if (daysInStock >= 45) {
    return {
      action: 'alert',
      reason: `${daysInStock} jours en stock sans vente. Envisager une baisse significative ou un partenariat de reprise.`,
      daysInStock,
    };
  }

  if (daysInStock >= 30) {
    return {
      action: 'reduce',
      amount: 500,
      reason: `${daysInStock} jours en stock — réduction recommandée de 500 €.`,
      daysInStock,
    };
  }

  // J+14
  return {
    action: 'reduce',
    amount: 300,
    reason: `${daysInStock} jours en stock — réduction recommandée de 300 €.`,
    daysInStock,
  };
}

/**
 * Returns vehicles that need price action, sorted by urgency.
 */
export function getVehiclesNeedingAction(vehicles: VehicleRecord[]): Array<{
  vehicle: VehicleRecord;
  action: PriceAction;
}> {
  return vehicles
    .filter((v) => ['en_stock', 'publie'].includes(v.status ?? ''))
    .map((v) => ({ vehicle: v, action: getPriceAction(v) }))
    .filter(({ action }) => action.action !== 'none')
    .sort((a, b) => {
      const order = { human_required: 0, alert: 1, reduce: 2, none: 3 };
      return order[a.action.action] - order[b.action.action];
    });
}
