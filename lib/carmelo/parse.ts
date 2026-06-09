// Pure parser that turns Carmelo's standardized report into structured fields.
// No DB / network — fully unit-testable. We control the output format in the
// system prompt, so parsing the labeled lines is deterministic and reliable.

import { extractDecision, type Decision } from './decision';

export type ParsedAnalysis = {
  vehiculeResume: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  km: number | null;
  fuel: string | null;
  gearbox: string | null;
  decision: Decision;
  marketPrice: number | null;
  recommendedMaxBuy: number | null;
  estimatedMargin: number | null;
  rotationScore: number | null;
  confidence: number | null;
  actionRecommandee: 'ACHETER' | 'NÉGOCIER' | 'SURVEILLER' | 'REJETER' | null;
};

// Common makes seen on the Belgian market (+ GP-CARS preferred brands).
const BRANDS = [
  'Kia', 'Hyundai', 'Toyota', 'Volkswagen', 'Audi', 'BMW', 'Mercedes',
  'Renault', 'Peugeot', 'Citroën', 'Opel', 'Ford', 'Skoda', 'Seat',
  'Volvo', 'Nissan', 'Mazda', 'Honda', 'Fiat', 'Dacia', 'Mini',
  'Suzuki', 'Mitsubishi', 'Tesla', 'Cupra', 'Land Rover', 'Jaguar',
  'Porsche', 'Alfa Romeo', 'Lexus',
];

// Parse a European price/number string ("17 500", "17.500", "13 800 €") to int.
function parseNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

function matchLine(report: string, pattern: RegExp): string | null {
  const m = report.match(pattern);
  return m ? m[1].trim() : null;
}

function detectMake(text: string | null): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const brand of BRANDS) {
    if (lower.includes(brand.toLowerCase())) return brand;
  }
  return null;
}

// The Carmelo system prompt enforces the format:
//   Véhicule : [MAKE MODEL YEAR / KM km / ENGINE FUEL GEARBOX]
// e.g.  "Kia Sportage GT Line 2022 / 45 000 km / 1.6 T-GDI 177 ch Essence automatique"
// We split on " / " and parse each segment independently.
function parseVehiculeResume(resume: string | null): {
  make: string | null;
  model: string | null;
  year: number | null;
  km: number | null;
  fuel: string | null;
  gearbox: string | null;
} {
  const empty = { make: null, model: null, year: null, km: null, fuel: null, gearbox: null };
  if (!resume) return empty;

  const segments = resume.split(/\s*\/\s*/);

  // Segment 0: "Kia Sportage GT Line 2022"
  const ident = segments[0] ?? '';
  const yearMatch = ident.match(/\b(20[12]\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
  const make = detectMake(ident);
  let model: string | null = null;
  if (make) {
    // Remove make prefix then year, trim what remains.
    const afterMake = ident.replace(new RegExp(make, 'i'), '').trim();
    model = (yearMatch ? afterMake.replace(yearMatch[1], '') : afterMake).trim() || null;
  }

  // Segment 1: "45 000 km"  or  "45.000 km"
  const kmRaw = segments[1] ?? '';
  const kmMatch = kmRaw.match(/([\d\s.]+)\s*km/i);
  const km = kmMatch ? parseNumber(kmMatch[1]) : null;

  // Segment 2+: "1.6 T-GDI 177 ch Essence automatique"
  const motorisation = segments.slice(2).join(' ');
  const fuelMatch = motorisation.match(/\b(essence|diesel|hybride|électrique|electric|hybrid)\b/i);
  const fuel = fuelMatch ? fuelMatch[1].toLowerCase() : null;
  const gearMatch = motorisation.match(/\b(automatique|auto|manuelle|manuelle)\b/i);
  const gearRaw = gearMatch ? gearMatch[1].toLowerCase() : null;
  const gearbox = gearRaw === 'auto' ? 'automatique' : gearRaw;

  return { make, model, year, km, fuel, gearbox };
}

export function parseReport(report: string): ParsedAnalysis {
  const text = report || '';

  const rawResume = matchLine(text, /V[ée]hicule\s*:\s*(.+)/i);
  const vehiculeResume = rawResume
    ? rawResume.replace(/^\[|\]$/g, '').trim() || null
    : null;

  const { make, model, year, km, fuel, gearbox } = parseVehiculeResume(vehiculeResume);

  const rawAction = matchLine(text, /Action recommand[ée]e\s*:\s*(\w+)/i)?.toUpperCase() ?? null;
  const actionRecommandee = (
    rawAction === 'ACHETER' || rawAction === 'NÉGOCIER' || rawAction === 'SURVEILLER' || rawAction === 'REJETER'
  ) ? rawAction as 'ACHETER' | 'NÉGOCIER' | 'SURVEILLER' | 'REJETER' : null;

  return {
    vehiculeResume,
    make,
    model,
    year,
    km,
    fuel,
    gearbox,
    decision: extractDecision(text),
    marketPrice: parseNumber(matchLine(text, /Prix march[ée]\s+r[ée]el\s*:\s*([\d.\s,]+)\s*€/i)),
    recommendedMaxBuy: parseNumber(matchLine(text, /PRIX MAXIMUM [ÀA] REMETTRE\s*:\s*([\d.\s,]+)\s*€/i)),
    estimatedMargin: parseNumber(matchLine(text, /Marge estim[ée]e\s*:\s*([\d.\s,]+)\s*€/i)),
    rotationScore: parseNumber(matchLine(text, /Score Rotation\s*:\s*([\d]+)\s*\/\s*10/i)),
    confidence: parseNumber(matchLine(text, /Niveau de confiance\s*:\s*([\d]+)\s*%/i)),
    actionRecommandee,
  };
}
