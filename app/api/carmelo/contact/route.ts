import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from 'app/auth';
import { cookies } from 'next/headers';
import { buildContactDraftPrompt } from '@/lib/carmelo/contact-prompt';
import { requireString, optionalPositiveInt, ValidationError } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';

// Rédige un message de première prise de contact.
// Toujours relu par un humain avant envoi — Carmelo ne contacte jamais seul.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  const email = session.user.email;

  const rl = checkRateLimit(`contact:${email}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes. Attendez une minute.' }, { status: 429 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || cookies().get('gp_api_key')?.value;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Clé API Anthropic non configurée. Rendez-vous sur /settings.' },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null);
  let vehicule: string;
  try {
    vehicule = requireString(body?.vehicule, 'vehicule', { maxLength: 500 });
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: 'Véhicule manquant.' }, { status: 400 });
  }

  const prompt = buildContactDraftPrompt({
    vehicule,
    askingPrice: optionalPositiveInt(body?.askingPrice),
    targetPrice: optionalPositiveInt(body?.targetPrice),
    langue: body?.langue === 'nl' ? 'nl' : 'fr',
  });

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
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
