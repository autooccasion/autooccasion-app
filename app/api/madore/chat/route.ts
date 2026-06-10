import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStockVehicles, saveLead } from 'app/db';
import { buildMadoreSystemPrompt } from '@/lib/madore/system-prompt';
import { matchStock, formatStockForPrompt } from '@/lib/madore/stock-match';
import { parseMadoreReport } from '@/lib/madore/parse-report';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 30;

type Message = { role: 'user' | 'assistant'; content: string };

// Public endpoint — no session required (prospects are not authenticated).
// Rate-limited by IP to prevent abuse.
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = checkRateLimit(`madore:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Trop de messages. Attendez une minute.' }, { status: 429 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Service temporairement indisponible.' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const messages: Message[] = Array.isArray(body?.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: 'Messages requis.' }, { status: 400 });
  }

  // Fetch live stock for the GP-CARS owner.
  const ownerEmail = process.env.NOTIFY_EMAIL ?? '';
  let stockBlock = 'Stock temporairement indisponible.';
  try {
    if (ownerEmail) {
      const allStock = await getStockVehicles(ownerEmail);
      // Match to rough criteria extracted from conversation context.
      const budgetMatch = messages.map((m) => m.content).join(' ').match(/(\d[\s\d]*)\s*€/);
      const budgetMax = budgetMatch ? Number(budgetMatch[1].replace(/\s/g, '')) : null;
      const relevant = budgetMax
        ? matchStock({ budgetMax }, allStock, 5)
        : allStock.slice(0, 5);
      stockBlock = relevant.length > 0
        ? formatStockForPrompt(relevant)
        : 'Aucun véhicule disponible en stock actuellement. Proposer une recherche personnalisée.';
    }
  } catch { /* stock fetch failure non-bloquante */ }

  const system = buildMadoreSystemPrompt(stockBlock);
  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let full = '';
      try {
        const messageStream = client.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system,
          messages,
        });

        for await (const event of messageStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        // Save lead if MADORE generated a report.
        if (full.includes('# RAPPORT MADORE')) {
          const report = parseMadoreReport(full);
          if (report) {
            await saveLead({ ...report, conversation: messages }).catch((err) =>
              console.error('MADORE: échec sauvegarde lead', err),
            );
          }
        }

        controller.close();
      } catch (err) {
        console.error('MADORE: erreur stream', err);
        controller.enqueue(encoder.encode('Désolé, une erreur est survenue. Veuillez réessayer.'));
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
