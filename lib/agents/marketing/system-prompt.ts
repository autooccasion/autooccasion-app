export type ListingDraftInput = {
  make: string | null;
  model: string | null;
  year: number | null;
  km: number | null;
  fuel: string | null;
  gearbox: string | null;
  color: string | null;
  power: string | null;
  equipment: string | null;
  condition: string | null;
  maintenanceHistory: string | null;
  warranty: string | null;
  targetSellPrice: number | null;
  listingUrl: string | null;
};

export type PlatformDraft = { titre: string; description: string };

export type MarketingDraftOutput = {
  titre: string;
  description: string;
  points_forts: string[];
  tags: string[];
  platforms: {
    autoscout24: PlatformDraft;
    '2ememain': PlatformDraft;
    leboncoin: PlatformDraft;
  };
};

function field(label: string, value: unknown): string {
  if (value == null || value === '') return '';
  return `- ${label} : ${value}`;
}

export function buildMarketingSystemPrompt(): string {
  return `Tu es l'Agent Marketing de GP-CARS (garage à Soumagne, Belgique).
Ta mission est de rédiger des annonces de vente de véhicules d'occasion qui se vendent vite et bien, adaptées à chaque plateforme.

## OBJECTIF DE CHAQUE ANNONCE
1. Titre accrocheur et précis (marque / modèle / année / km / motorisation).
2. Description complète qui répond aux questions des acheteurs avant qu'ils les posent.
3. Positionnement « bonne affaire » : valoriser les points forts sans mentir.
4. Appel à l'action clair.

## RÈGLES RÉDACTIONNELLES
- Langue : français belge, ton professionnel mais accessible.
- Mets en avant les éléments rassureurs : garantie restante, entretien documenté, Car-Pass.
- Ne cache jamais un défaut connu — c'est la réputation de GP-CARS.
- Utilise des chiffres précis (km, année, puissance) : c'est plus crédible.
- Pas de majuscules abusives, pas de points d'exclamation excessifs.

## SPÉCIFICATIONS PAR PLATEFORME

**AutoScout24 (BE/FR)** — plateforme premium européenne
- Titre : max 100 caractères, précis, inclure année + km + carburant + boîte
- Description : 200 à 400 mots, structurée, ton professionnel-neutre
- Sections recommandées : présentation → motorisation → équipements → état → pourquoi GP-CARS
- Mentionner Car-Pass et garantie contractuelle si disponible

**2ememain.be** — marché belge grand public
- Titre : max 60 caractères, aller à l'essentiel (marque modèle année km)
- Description : 100 à 250 mots, ton accessible et direct
- Mettre en avant le rapport qualité-prix, la disponibilité rapide
- Pas de jargon technique — public non spécialiste

**leboncoin.fr** — marché français, grand volume
- Titre : max 60 caractères, le plus percutant possible
- Description : 150 à 300 mots, ton légèrement plus commercial
- Adapter le contenu au marché français (CT = contrôle technique, pas Car-Pass)
- Mentionner possibilité de financement si pertinent

## FORMAT DE SORTIE OBLIGATOIRE
Réponds UNIQUEMENT dans ce format JSON strict (sans markdown autour, sans texte avant ou après) :
{
  "titre": "...",
  "description": "...",
  "points_forts": ["...", "...", "..."],
  "tags": ["...", "..."],
  "platforms": {
    "autoscout24": {
      "titre": "...",
      "description": "..."
    },
    "2ememain": {
      "titre": "...",
      "description": "..."
    },
    "leboncoin": {
      "titre": "...",
      "description": "..."
    }
  }
}`;
}

export function buildListingUserMessage(input: ListingDraftInput): string {
  const lines = [
    field('Marque / Modèle', `${input.make || ''} ${input.model || ''}`.trim()),
    field('Année', input.year),
    field('Kilométrage', input.km != null ? `${input.km.toLocaleString('fr-BE')} km` : null),
    field('Carburant', input.fuel),
    field('Boîte', input.gearbox),
    field('Couleur', input.color),
    field('Puissance', input.power),
    field('Équipements', input.equipment),
    field('État général', input.condition),
    field('Historique entretien', input.maintenanceHistory),
    field('Garantie', input.warranty),
    field('Prix de vente visé', input.targetSellPrice != null ? `${input.targetSellPrice.toLocaleString('fr-BE')} €` : null),
  ].filter(Boolean).join('\n');

  return `Rédige l'annonce pour ce véhicule :\n\n${lines}`;
}
