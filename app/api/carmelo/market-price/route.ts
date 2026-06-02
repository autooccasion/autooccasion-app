import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Clé API Anthropic non configurée. Ajoute ANTHROPIC_API_KEY dans Vercel → Settings → Environment Variables.' },
      { status: 500 },
    );
  }

  const body = await req.json();
  const { marque, modele, annee, kilometrage, motorisation } = body as {
    marque: string;
    modele: string;
    annee: number;
    kilometrage: number;
    motorisation: string;
  };

  if (!marque || !modele || !annee || !motorisation) {
    return NextResponse.json({ error: 'Données insuffisantes' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `Recherche le prix du marché belge actuel pour ce véhicule d'occasion :
${marque} ${modele} ${annee}, environ ${kilometrage.toLocaleString('fr')} km, motorisation ${motorisation}.

Cherche sur AutoScout24.be et/ou 2dehands.be des annonces similaires (même marque, modèle, année ±1 an, kilométrage ±20 000 km).

Retourne UNIQUEMENT ce JSON (rien d'autre, pas d'explication) :
{"prixEstime": <prix médian en euros entier>, "fourchette": {"min": <prix min>, "max": <prix max>}, "nbAnnonces": <nombre trouvé>, "source": "<plateforme utilisée>"}

Si tu ne trouves aucune annonce, retourne :
{"prixEstime": 0, "fourchette": {"min": 0, "max": 0}, "nbAnnonces": 0, "source": "indisponible"}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 512,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }] as any,
    messages: [{ role: 'user', content: prompt }],
  });

  let jsonText = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      jsonText = block.text;
    }
  }

  const match = jsonText.match(/\{[\s\S]*\}/);
  if (!match) {
    return NextResponse.json({ error: 'Impossible de parser la réponse Claude' }, { status: 500 });
  }

  const data = JSON.parse(match[0]);
  return NextResponse.json(data);
}
