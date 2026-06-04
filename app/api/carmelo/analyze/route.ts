import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildCarmeloSystemPrompt } from '@/lib/carmelo/system-prompt';
import { auth } from 'app/auth';
import { cookies } from 'next/headers';
import { saveAnalysis } from 'app/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  const email = session.user.email;

  const apiKey =
    process.env.ANTHROPIC_API_KEY ||
    cookies().get('gp_api_key')?.value;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Clé API Anthropic non configurée. Rendez-vous sur /settings pour l\'ajouter.' },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const vehicule = body?.vehicule;

  if (!vehicule || typeof vehicule !== 'string' || vehicule.trim().length === 0) {
    return NextResponse.json({ error: 'Données véhicule manquantes.' }, { status: 400 });
  }
  const vehiculeText = vehicule.trim();

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let full = '';
      try {
        const messageStream = client.messages.stream({
          model: 'claude-opus-4-8',
          max_tokens: 2048,
          system: buildCarmeloSystemPrompt(),
          messages: [{ role: 'user', content: vehiculeText }],
        });

        for await (const event of messageStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        // Persist the completed analysis (best-effort — never break the stream).
        if (full.trim().length > 0) {
          try {
            await saveAnalysis(email, vehiculeText, full);
          } catch (err) {
            console.error('Carmelo: échec sauvegarde historique', err);
          }
        }

        controller.close();
      } catch (err) {
        console.error('Carmelo: erreur analyse', err);
        if (full.length === 0) {
          controller.enqueue(
            encoder.encode("⚠️ Erreur lors de l'analyse. Vérifiez la clé API et réessayez."),
          );
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
