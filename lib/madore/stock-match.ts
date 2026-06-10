import type { VehicleRecord } from 'app/db';

export type ProspectCriteria = {
  budgetMax?: number | null;
  familySize?: number | null;
  fuelPreference?: string | null;   // 'essence' | 'diesel' | 'hybride' | 'electrique'
  gearboxPreference?: string | null; // 'automatique' | 'manuelle'
  typePreference?: string | null;    // 'suv' | 'citadine' | 'berline' | 'break' | 'crossover'
  kmMaxYear?: number | null;         // annual km usage (to prefer low-km cars)
};

function scoreCar(v: VehicleRecord, c: ProspectCriteria): number {
  let score = 0;

  // Budget — hard filter but also score proximity
  if (c.budgetMax != null && v.askingPrice != null) {
    if (v.askingPrice > c.budgetMax) return -999;
    const ratio = v.askingPrice / c.budgetMax;
    // Sweet spot: 80-100% of budget
    if (ratio >= 0.80) score += 3;
    else if (ratio >= 0.60) score += 1;
  }

  // Fuel preference
  if (c.fuelPreference && v.fuel) {
    const pref = c.fuelPreference.toLowerCase();
    const fuel = v.fuel.toLowerCase();
    if (fuel.includes(pref) || pref.includes(fuel)) score += 3;
    // Hybrid always gets a bonus for "economical" preference
    if (pref === 'economique' && fuel.includes('hybrid')) score += 2;
  }

  // Gearbox
  if (c.gearboxPreference && v.gearbox) {
    if (v.gearbox.toLowerCase().includes(c.gearboxPreference.toLowerCase())) score += 2;
  }

  // Family size — large family (4+) needs SUV/break
  if (c.familySize != null && c.familySize >= 4) {
    const make = (v.make ?? '').toLowerCase();
    const model = (v.model ?? '').toLowerCase();
    const suv = ['sportage', 'tucson', 'rav4', 'tiguan', 'qashqai', 'koleos', 't-roc', 'kona', 'stonic', 'bayon'];
    if (suv.some((s) => model.includes(s) || make.includes(s))) score += 2;
  }

  // Recent + low km = reliability bonus
  if (v.year != null && v.year >= 2022) score += 1;
  if (v.km != null && v.km < 30000) score += 2;
  else if (v.km != null && v.km < 60000) score += 1;

  // Published vehicles are ready to go — bonus
  if (v.status === 'publie') score += 1;

  return score;
}

export function matchStock(
  criteria: ProspectCriteria,
  vehicles: VehicleRecord[],
  limit = 3,
): VehicleRecord[] {
  return vehicles
    .map((v) => ({ v, score: scoreCar(v, criteria) }))
    .filter(({ score }) => score > -999)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ v }) => v);
}

export function formatStockForPrompt(vehicles: VehicleRecord[]): string {
  if (vehicles.length === 0) return 'Aucun véhicule disponible en stock actuellement.';
  return vehicles.map((v) => {
    const label = [v.make, v.model, v.year].filter(Boolean).join(' ');
    const km = v.km != null ? `${v.km.toLocaleString('fr-BE')} km` : '?? km';
    const price = v.askingPrice != null ? `${v.askingPrice.toLocaleString('fr-BE')} €` : 'prix à confirmer';
    const fuel = v.fuel ?? '—';
    const gearbox = v.gearbox ?? '—';
    const status = v.status === 'publie' ? 'disponible immédiatement' : 'bientôt disponible';
    return `• ${label} — ${km} — ${fuel} — ${gearbox} — ${price} (${status})`;
  }).join('\n');
}
