import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildCarmeloSystemPrompt } from '@/lib/carmelo/system-prompt';
import { fetchListing } from '@/lib/carmelo/fetch-listing';
import { selectRelevant, buildMemoryBlock } from '@/lib/carmelo/memory';
import { auth } from 'app/auth';
import { cookies } from 'next/headers';
import { saveAnalysis, getAnalyses } from 'app/db';

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
  const vehicule = typeof body?.vehicule === 'string' ? body.vehicule.trim() : '';
  const url = typeof body?.url === 'string' ? body.url.trim() : '';

  if (!vehicule && !url) {
    return NextResponse.json(
      { error: 'Fournissez une description ou un lien d\'annonce.' },
      { status: 400 },
    );
  }

  // 1. Try to read the listing from its link so Carmelo checks the real ad.
  let listingText = '';
  let listingNote = '';
  if (url) {
    const listing = await fetchListing(url);
    if (listing.ok && listing.text) {
      listingText = listing.text;
    } else {
      listingNote = listing.error || 'Lien illisible.';
    }
  }

  if (!vehicule && !listingText) {
    return NextResponse.json(
      { error: `Impossible de lire le lien : ${listingNote} Collez le texte de l'annonce.` },
      { status: 422 },
    );
  }

  // 2. Pull GP-CARS memory (real outcomes) relevant to this vehicle.
  let memoryBlock = '';
  try {
    const haystack = `${listingText} ${vehicule}`;
    const past = await getAnalyses(email, 40);
    const relevant = selectRelevant(past, haystack);
    memoryBlock = buildMemoryBlock(relevant);
  } catch (err) {
    console.error('Carmelo: mémoire indisponible', err);
  }

  // 3. Assemble the user message: listing + description + memory.
  const parts: string[] = [];
  if (url) parts.push(`LIEN DE L'ANNONCE : ${url}`);
  if (listingText) {
    parts.push(`ANNONCE EXTRAITE DU LIEN (à vérifier contre les critères) :\n${listingText}`);
  } else if (listingNote) {
    parts.push(`(Lien non lisible automatiquement : ${listingNote})`);
  }
  if (vehicule) parts.push(`DESCRIPTION FOURNIE :\n${vehicule}`);
  if (memoryBlock) parts.push(memoryBlock);
  const userMessage = parts.join('\n\n');

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
          messages: [{ role: 'user', content: userMessage }],
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
            await saveAnalysis(email, vehicule, full, url || null);
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
