import type { SaveLeadInput } from 'app/db';

// Extracts the # RAPPORT MADORE block from the last assistant message.
export function parseMadoreReport(text: string): SaveLeadInput | null {
  const match = text.match(/# RAPPORT MADORE\s*([\s\S]+?)(?:\n#|\n\n\n|$)/i);
  if (!match) return null;

  const block = match[1];

  function field(label: string): string {
    const re = new RegExp(`${label}\\s*:\\s*(.+)`, 'i');
    return block.match(re)?.[1]?.trim() ?? '';
  }

  function num(s: string): number | null {
    const n = Number(s.replace(/[^\d]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function bool(s: string): boolean | null {
    if (/^oui$/i.test(s)) return true;
    if (/^non$/i.test(s)) return false;
    return null;
  }

  const score = num(field('Score'));
  const prob  = num(field('Probabilité de vente'));

  const priorityRaw = field('Priorité').toUpperCase();
  const priority = ['ROUGE', 'ORANGE', 'VERT'].includes(priorityRaw) ? priorityRaw : null;

  return {
    prospectName:      field('Nom') || null,
    prospectPhone:     field('Téléphone') || null,
    prospectEmail:     field('Email') || null,
    vehicleSearch:     field('Véhicule recherché') || null,
    budget:            num(field('Budget')),
    financing:         bool(field('Financement')),
    tradeIn:           bool(field('Reprise')),
    buyDelay:          field("Délai d'achat") || null,
    score:             score,
    priority:          priority,
    saleProbability:   prob,
    summary:           field('Résumé') || null,
    actionRecommended: field('Action recommandée') || null,
  };
}
