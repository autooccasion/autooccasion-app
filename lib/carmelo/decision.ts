// Pure helpers for interpreting Carmelo's output — no DB / network dependencies,
// so they can be unit-tested in isolation.

export type Decision = 'VERT' | 'ORANGE' | 'ROUGE' | 'INCONNU';

// Extract the colour decision from Carmelo's structured output.
// Priority order matters: a refusal (ROUGE) must win over any mention of
// the other zones in the analysis body.
export function extractDecision(analyse: string): Decision {
  const text = (analyse || '').toUpperCase();
  if (text.includes('ROUGE')) return 'ROUGE';
  if (text.includes('ORANGE')) return 'ORANGE';
  if (text.includes('VERT')) return 'VERT';
  return 'INCONNU';
}
