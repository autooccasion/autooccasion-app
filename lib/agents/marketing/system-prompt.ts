import { MARQUES_PREFEREES } from '@/lib/carmelo/config';

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

function field(label: string, value: unknown): string {
  if (value == null || value === '') return '';
  return `- ${label} : ${value}`;
}

export function buildMarketingSystemPrompt(): string {
  return `Tu es l'Agent Marketing de GP-CARS (garage à Soumagne, Belgique).
Ta mission est de rédiger des annonces de vente de véhicules d'occasion qui se vendent vite et bien.

## OBJECTIF DE CHAQUE ANNONCE
1. Titre accrocheur et précis (marque / modèle / année / km / motorisation — max 80 caractères).
2. Description complète qui répond aux questions des acheteurs avant qu'ils les posent.
3. Positionnement « bonne affaire » : valoriser les points forts sans mentir.
4. Appel à l'action clair.

## RÈGLES RÉDACTIONNELLES
- Langue : français belge, ton professionnel mais accessible.
- Mets en avant les éléments rassureurs : garantie restante, entretien documenté, Car-Pass.
- Ne cache jamais un défaut connu — c'est la réputation de GP-CARS.
- Utilise des chiffres précis (km, année, puissance) : c'est plus crédible.
- Pas de majuscules abusives, pas de points d'exclamation excessifs.
- Description : 150 à 250 mots, structurée (présentation / équipements / état / achat chez nous).

## FORMAT DE SORTIE OBLIGATOIRE
Réponds UNIQUEMENT dans ce format JSON strict (sans markdown autour) :
{
  "titre": "...",
  "description": "...",
  "points_forts": ["...", "...", "..."],
  "tags": ["...", "..."]
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
