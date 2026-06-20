// CRUD for the central Vehicle table. All agents share this endpoint.
import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import {
  createVehicle, getVehicles, getVehicle,
  updateVehicleStatus, recordSale, getVehicleSummaries,
  updateVehicleFeedback, createAtelierIntervention, publishEvent,
  type VehicleStatus,
} from 'app/db';
import { assertBody, optionalPositiveInt, optionalString, requirePositiveInt, ValidationError } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';

const VALID_STATUSES: VehicleStatus[] = [
  'prospect','analyse','achete','en_stock','publie','vendu','refuse',
];

// GET /api/agents/vehicle?summary=true
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get('summary') === 'true') {
    const summaries = await getVehicleSummaries(session.user.email);
    return NextResponse.json({ vehicles: summaries });
  }
  const vehicles = await getVehicles(session.user.email);
  return NextResponse.json({ vehicles });
}

// POST /api/agents/vehicle
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const rl = checkRateLimit(`vehicle:${email}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  }

  const rawBody = await req.json().catch(() => null);

  try {
    assertBody(rawBody);
    const action = optionalString(rawBody.action);

    // --- Update status ---
    if (action === 'set_status') {
      const id = requirePositiveInt(rawBody.id, 'id');
      const status = rawBody.status;
      if (typeof status !== 'string' || !VALID_STATUSES.includes(status as VehicleStatus)) {
        return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
      }
      const extra: Record<string, unknown> = {};
      if (status === 'achete') {
        const price = optionalPositiveInt(rawBody.realBuyPrice);
        if (price) extra.realBuyPrice = price;
        if (rawBody.boughtAt) extra.boughtAt = new Date(rawBody.boughtAt as string);
      }
      if (status === 'publie') {
        extra.publishedAt = new Date();
        if (Array.isArray(rawBody.platforms)) extra.publishedPlatforms = rawBody.platforms;
      }
      await updateVehicleStatus(id, email, status as VehicleStatus, extra as any);

      if (status === 'achete') {
        const vehicle = await getVehicle(id, email);
        const label = vehicle ? `${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim() : `Véhicule #${id}`;
        const intervention = await createAtelierIntervention(
          id, email, 'preparation_vente',
          `Préparation à la vente — ${label}`,
        );
        await publishEvent('atelier.intervention_creee', 'atelier', {
          vehicleId: id, interventionId: intervention.id, vehicleLabel: label,
        });
      }

      return NextResponse.json({ ok: true });
    }

    // --- Feedback on analysis quality ---
    if (action === 'set_feedback') {
      const id = requirePositiveInt(rawBody.id, 'id');
      const fb = rawBody.feedback;
      if (fb !== 'correct' && fb !== 'incorrect') {
        return NextResponse.json({ error: 'feedback doit être "correct" ou "incorrect".' }, { status: 400 });
      }
      await updateVehicleFeedback(id, email, fb);
      return NextResponse.json({ ok: true });
    }

    // --- Record sale ---
    if (action === 'record_sale') {
      const id = requirePositiveInt(rawBody.id, 'id');
      const price = requirePositiveInt(rawBody.realSellPrice, 'realSellPrice');
      const soldAt = rawBody.soldAt ? new Date(rawBody.soldAt as string) : new Date();
      await recordSale(id, email, price, soldAt);
      return NextResponse.json({ ok: true });
    }

    // --- Create new vehicle ---
    const rows = await createVehicle(email, {
      make: optionalString(rawBody.make, { maxLength: 48 }),
      model: optionalString(rawBody.model, { maxLength: 64 }),
      year: optionalPositiveInt(rawBody.year),
      km: optionalPositiveInt(rawBody.km),
      fuel: optionalString(rawBody.fuel, { maxLength: 32 }),
      gearbox: optionalString(rawBody.gearbox, { maxLength: 32 }),
      color: optionalString(rawBody.color, { maxLength: 32 }),
      power: optionalString(rawBody.power, { maxLength: 32 }),
      vin: optionalString(rawBody.vin, { maxLength: 20 }),
      listingUrl: optionalString(rawBody.listingUrl),
      askingPrice: optionalPositiveInt(rawBody.askingPrice),
      marketPrice: optionalPositiveInt(rawBody.marketPrice),
      maxBuyPrice: optionalPositiveInt(rawBody.maxBuyPrice),
      estimatedMargin: optionalPositiveInt(rawBody.estimatedMargin),
      rotationScore: optionalPositiveInt(rawBody.rotationScore),
      confidence: optionalPositiveInt(rawBody.confidence),
      decision: optionalString(rawBody.decision) as any,
      analysisReport: optionalString(rawBody.analysisReport),
      analysisId: optionalPositiveInt(rawBody.analysisId),
    });
    return NextResponse.json({ vehicle: rows[0] });

  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('Vehicle route error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
