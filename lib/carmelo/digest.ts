// Builds the daily "good deals" summary Carmelo sends/shows. Pure — testable.

export type DigestOpportunity = {
  vehicule?: string | null;
  url?: string | null;
  askingPrice?: number | null;
  targetSell?: number | null;
  maxBuy?: number | null;
  zone?: string | null;
};

function euro(n: number | null | undefined): string {
  return n == null ? '?' : `${n.toLocaleString('fr-BE')} €`;
}

export type Digest = {
  count: number;
  title: string;
  text: string;
};

export function buildDigest(
  opportunities: DigestOpportunity[],
  date = new Date(),
): Digest {
  const count = opportunities.length;
  const jour = new Intl.DateTimeFormat('fr-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);

  if (count === 0) {
    return {
      count: 0,
      title: 'Aucune nouvelle opportunité',
      text: `Bilan du ${jour} : aucune bonne affaire détectée pour le moment.`,
    };
  }

  const lines = opportunities.map((o, i) => {
    const label = o.vehicule || 'Véhicule';
    const parts = [
      `${i + 1}. ${label}`,
      `   Prix demandé : ${euro(o.askingPrice)} · Achat max conseillé : ${euro(o.maxBuy)} · Revente cible : ${euro(o.targetSell)}`,
    ];
    if (o.url) parts.push(`   Annonce : ${o.url}`);
    return parts.join('\n');
  });

  const title =
    count === 1
      ? '1 bonne affaire à regarder'
      : `${count} bonnes affaires à regarder`;

  const text = [
    `Bonjour, voici le bilan marché du ${jour}.`,
    `${title} :`,
    '',
    lines.join('\n\n'),
    '',
    'Ouvrez Carmelo → Opportunités pour préparer la prise de contact.',
  ].join('\n');

  return { count, title, text };
}
