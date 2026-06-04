import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from 'app/auth';
import { cookies } from 'next/headers';
import { getVehicle, saveMarketingDraft, updateVehicleStatus } from 'app/db';
import { buildMarketingSystemPrompt, buildListingUserMessage } from '@/lib/agents/marketing/system-prompt';
import { requirePositiveInt, optionalString, ValidationError } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const rl = checkRateLimit(`marketing:${email}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || cookies().get('gp_api_key')?.value;
  if (!apiKey) return NextResponse.json({ error: 'Clé API non configurée.' }, { status: 500 });

  const rawBody = await req.json().catch(() => null);
  let vehicleId: number;
  try {
    vehicleId = requirePositiveInt(rawBody?.vehicleId, 'vehicleId');
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: 'vehicleId invalide.' }, { status: 400 });
  }

  const row = await getVehicle(vehicleId, email);
  if (!row) return NextResponse.json({ error: 'Véhicule introuvable.' }, { status: 404 });

  const client = new Anthropic({ apiKey });

  const userMessage = buildListingUserMessage({
    make: row.make,
    model: row.model,
    year: row.year,
    km: row.km,
    fuel: row.fuel,
    gearbox: row.gearbox,
    color: row.color,
    power: row.power,
    equipment: optionalString(rawBody?.equipment),
    condition: optionalString(rawBody?.condition),
    maintenanceHistory: optionalString(rawBody?.maintenanceHistory),
    warranty: optionalString(rawBody?.warranty),
    targetSellPrice: row.marketPrice ?? null,
    listingUrl: row.listingUrl,
  });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: buildMarketingSystemPrompt(),
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';

    let draft: { titre?: string; description?: string; points_forts?: string[]; tags?: string[] } = {};
    try {
      draft = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Réponse inattendue de l'agent marketing.", raw: text },
        { status: 500 },
      );
    }

    await saveMarketingDraft(vehicleId, email, {
      title: draft.titre || '',
      description: draft.description || '',
      points: draft.points_forts || [],
      tags: draft.tags || [],
    });

    return NextResponse.json({ draft });
  } catch (err) {
    console.error('Agent marketing: erreur', err);
    return NextResponse.json({ error: 'Échec de la rédaction.' }, { status: 500 });
  }
}
