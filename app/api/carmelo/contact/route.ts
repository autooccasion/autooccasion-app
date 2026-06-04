import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from 'app/auth';
import { cookies } from 'next/headers';
import { buildContactDraftPrompt } from '@/lib/carmelo/contact-prompt';

// Drafts a first-contact message for a HUMAN to review and send.
// Carmelo never contacts the seller on its own.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || cookies().get('gp_api_key')?.value;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Clé API Anthropic non configurée. Rendez-vous sur /settings.' },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null);
  const vehicule = typeof body?.vehicule === 'string' ? body.vehicule.trim() : '';
  if (!vehicule) {
    return NextResponse.json({ error: 'Véhicule manquant.' }, { status: 400 });
  }

  const prompt = buildContactDraftPrompt({
    vehicule,
    askingPrice: Number.isFinite(Number(body?.askingPrice)) ? Number(body.askingPrice) : null,
    targetPrice: Number.isFinite(Number(body?.targetPrice)) ? Number(body.targetPrice) : null,
    langue: body?.langue === 'nl' ? 'nl' : 'fr',
  });

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });
    const content = response.content[0];
    const message = content && content.type === 'text' ? content.text : '';
    return NextResponse.json({ message });
  } catch (err) {
    console.error('Carmelo: échec rédaction message', err);
    return NextResponse.json({ error: 'Échec de la rédaction du message.' }, { status: 500 });
  }
}
