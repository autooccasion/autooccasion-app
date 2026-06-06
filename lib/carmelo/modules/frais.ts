import { VehicleData, FraisDetail, PaysOrigine } from '../types';

function calculerTransport(distanceKm: number, paysOrigine: PaysOrigine): number {
  if (paysOrigine === 'BE') {
    if (distanceKm < 50) return 0;
    if (distanceKm < 150) return 100;
    return 200;
  }

  if (['FR', 'DE', 'NL', 'LU'].includes(paysOrigine)) {
    if (distanceKm < 300) return 350;
    return 500;
  }

  // autre
  return 600;
}

export function calculerFrais(data: VehicleData): FraisDetail {
  const ct = data.ctValide ? 0 : 105;
  const preparation = 100;
  const publicite = 200;

  let entretien = 0;
  if (!data.entretienRecent) {
    entretien = data.devisEntretien !== undefined ? data.devisEntretien : 250;
  }

  let pneus = 0;
  if (!data.pneusOk) {
    pneus = data.devisPneus !== undefined ? data.devisPneus : 500;
  }

  let freins = 0;
  if (!data.freinsOk) {
    freins = data.devisFreins !== undefined ? data.devisFreins : 350;
  }

  let carrosserie = 0;
  if (!data.carrosseriePropre) {
    carrosserie = data.devisCarrosserie !== undefined ? data.devisCarrosserie : 0;
  }

  const transport = calculerTransport(data.distanceKm, data.paysOrigine);

  // Garantie vendue : si hors garantie constructeur et km > 40 000, prévoir coût garantie revendue
  let garantieVendue: number | undefined;
  if (!data.garantieConstructeur && data.kilometrage > 40000) {
    garantieVendue = 300;
  }

  const total = ct + preparation + publicite + entretien + pneus + freins + carrosserie + transport + (garantieVendue ?? 0);

  return { ct, preparation, publicite, entretien, pneus, freins, carrosserie, transport, garantieVendue, total };
}
