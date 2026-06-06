// Pure parser that turns Carmelo's standardized report into structured fields.
// No DB / network — fully unit-testable. We control the output format in the
// system prompt, so parsing the labeled lines is deterministic and reliable.

import { extractDecision, type Decision } from './decision';

export type ParsedAnalysis = {
  vehiculeResume: string | null;
  make: string | null;
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

function detectMake(resume: string | null): string | null {
  if (!resume) return null;
  const lower = resume.toLowerCase();
  for (const brand of BRANDS) {
    if (lower.includes(brand.toLowerCase())) return brand;
  }
  return null;
}

export function parseReport(report: string): ParsedAnalysis {
  const text = report || '';

  const rawResume = matchLine(text, /V[ée]hicule\s*:\s*(.+)/i);
  const vehiculeResume = rawResume
    ? rawResume.replace(/^\[|\]$/g, '').trim() || null
    : null;

  const rawAction = matchLine(text, /Action recommand[ée]e\s*:\s*(\w+)/i)?.toUpperCase() ?? null;
  const actionRecommandee = (
    rawAction === 'ACHETER' || rawAction === 'NÉGOCIER' || rawAction === 'SURVEILLER' || rawAction === 'REJETER'
  ) ? rawAction as 'ACHETER' | 'NÉGOCIER' | 'SURVEILLER' | 'REJETER' : null;

  return {
    vehiculeResume,
    make: detectMake(vehiculeResume),
    decision: extractDecision(text),
    marketPrice: parseNumber(matchLine(text, /Prix march[ée]\s+r[ée]el\s*:\s*([\d.\s,]+)\s*€/i)),
    recommendedMaxBuy: parseNumber(matchLine(text, /PRIX MAXIMUM [ÀA] REMETTRE\s*:\s*([\d.\s,]+)\s*€/i)),
    estimatedMargin: parseNumber(matchLine(text, /Marge estim[ée]e\s*:\s*([\d.\s,]+)\s*€/i)),
    rotationScore: parseNumber(matchLine(text, /Score Rotation\s*:\s*([\d]+)\s*\/\s*10/i)),
    confidence: parseNumber(matchLine(text, /Niveau de confiance\s*:\s*([\d]+)\s*%/i)),
    actionRecommandee,
  };
}
