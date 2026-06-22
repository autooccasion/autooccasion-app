import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from 'app/auth';
import { getLegalRegulation, updateLegalRegulation } from 'app/db';
import { cookies } from 'next/headers';

const TOPIC = 'garantie-vo-belgique';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const regulation = await getLegalRegulation(session.user.email, TOPIC);
  return NextResponse.json({ regulation });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const body = await req.json().catch(() => ({}));

  // Manual edit: just save the new content.
  if (body.content && body.updatedBy === 'human') {
    const rows = await updateLegalRegulation(email, TOPIC, body.content, 'human');
    return NextResponse.json({ regulation: rows[0] });
  }

  // AI refresh: ask Claude to review and update.
  const apiKey = process.env.ANTHROPIC_API_KEY || cookies().get('gp_api_key')?.value;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Clé API Anthropic non configurée. Rendez-vous sur /settings." },
      { status: 500 },
    );
  }

  const current = await getLegalRegulation(email, TOPIC);
  const currentContent = current?.content ?? '(aucune réglementation enregistrée)';

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `Tu es expert en droit de la consommation belge, spécialisé en vente de véhicules d'occasion.

Voici la réglementation actuellement enregistrée dans notre système GP-CARS :

---
${currentContent}
---

Ta mission :
1. Vérifie si cette réglementation est toujours exacte et complète à la date d'aujourd'hui.
2. Corrige ou complète ce qui doit l'être (nouvelles directives UE, lois belges récentes, jurisprudence importante).
3. Conserve le même format et la même structure.
4. Réponds avec UNIQUEMENT le texte réglementaire mis à jour (pas d'explication autour), suivi de 2 sauts de ligne, puis une ligne commençant par "RÉSUMÉ DES MODIFICATIONS:" avec une courte liste des changements apportés (ou "Aucune modification nécessaire" si tout est à jour).`,
    }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const separatorIdx = raw.lastIndexOf('RÉSUMÉ DES MODIFICATIONS:');
  const updatedContent = separatorIdx > 0 ? raw.slice(0, separatorIdx).trim() : raw.trim();
  const aiSummary = separatorIdx > 0 ? raw.slice(separatorIdx + 'RÉSUMÉ DES MODIFICATIONS:'.length).trim() : null;

  const rows = await updateLegalRegulation(email, TOPIC, updatedContent, 'ai', aiSummary);
  return NextResponse.json({ regulation: rows[0], summary: aiSummary });
}
