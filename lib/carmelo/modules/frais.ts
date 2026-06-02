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
    pneus = data.devisPneus !== undefined ? data.devisPneus : 450;
  }

  let freins = 0;
  if (!data.freinsOk) {
    freins = data.devisFreins !== undefined ? data.devisFreins : 300;
  }

  let carrosserie = 0;
  if (!data.carrosseriePropre) {
    carrosserie = data.devisCarrosserie !== undefined ? data.devisCarrosserie : 0;
  }

  const transport = calculerTransport(data.distanceKm, data.paysOrigine);

  const total = ct + preparation + publicite + entretien + pneus + freins + carrosserie + transport;

  return { ct, preparation, publicite, entretien, pneus, freins, carrosserie, transport, total };
}
