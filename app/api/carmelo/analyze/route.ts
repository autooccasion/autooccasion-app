import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildCarmeloSystemPrompt } from '@/lib/carmelo/system-prompt';
import { auth } from 'app/auth';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Clé API Anthropic manquante. Configurez ANTHROPIC_API_KEY dans les variables d\'environnement.' },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const vehicule = body?.vehicule;

  if (!vehicule || typeof vehicule !== 'string' || vehicule.trim().length === 0) {
    return NextResponse.json({ error: 'Données véhicule manquantes.' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    system: buildCarmeloSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: vehicule.trim(),
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Réponse inattendue.' }, { status: 500 });
  }

  return NextResponse.json({ analyse: content.text });
}
