import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildCarmeloSystemPrompt } from '@/lib/carmelo/system-prompt';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { vehicule } = await req.json();

  if (!vehicule || typeof vehicule !== 'string' || vehicule.trim().length === 0) {
    return NextResponse.json({ error: 'Données véhicule manquantes.' }, { status: 400 });
  }

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
