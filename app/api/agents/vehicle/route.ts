// CRUD for the central Vehicle table. All agents share this endpoint.
import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import {
  createVehicle, getVehicles, getVehicle,
  updateVehicleStatus, recordSale, getVehicleSummaries,
  type VehicleStatus,
} from 'app/db';

const VALID_STATUSES: VehicleStatus[] = [
  'prospect','analyse','achete','en_stock','publie','vendu','refuse',
];

function toInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

// GET /api/agents/vehicle?summary=true  — list or summaries
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

// POST /api/agents/vehicle — create or update
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Corps de requête manquant.' }, { status: 400 });

  const action = body.action as string | undefined;

  // --- Update status ---
  if (action === 'set_status') {
    const id = toInt(body.id);
    const status = body.status as string;
    if (!id || !VALID_STATUSES.includes(status as VehicleStatus)) {
      return NextResponse.json({ error: 'id ou status invalide.' }, { status: 400 });
    }
    const extra: Record<string, unknown> = {};
    if (status === 'achete' && body.realBuyPrice) extra.realBuyPrice = toInt(body.realBuyPrice);
    if (status === 'achete' && body.boughtAt) extra.boughtAt = new Date(body.boughtAt);
    if (status === 'publie' && body.platforms) extra.publishedPlatforms = body.platforms;
    if (status === 'publie') extra.publishedAt = new Date();
    await updateVehicleStatus(id, email, status as VehicleStatus, extra as any);
    return NextResponse.json({ ok: true });
  }

  // --- Record sale ---
  if (action === 'record_sale') {
    const id = toInt(body.id);
    const price = toInt(body.realSellPrice);
    const soldAt = body.soldAt ? new Date(body.soldAt) : new Date();
    if (!id || !price) return NextResponse.json({ error: 'id ou prix de vente invalide.' }, { status: 400 });
    await recordSale(id, email, price, soldAt);
    return NextResponse.json({ ok: true });
  }

  // --- Create new vehicle ---
  const rows = await createVehicle(email, {
    make: body.make ?? null,
    model: body.model ?? null,
    year: toInt(body.year),
    km: toInt(body.km),
    fuel: body.fuel ?? null,
    gearbox: body.gearbox ?? null,
    color: body.color ?? null,
    power: body.power ?? null,
    vin: body.vin ?? null,
    listingUrl: body.listingUrl ?? null,
    askingPrice: toInt(body.askingPrice),
    marketPrice: toInt(body.marketPrice),
    maxBuyPrice: toInt(body.maxBuyPrice),
    estimatedMargin: toInt(body.estimatedMargin),
    rotationScore: toInt(body.rotationScore),
    confidence: toInt(body.confidence),
    decision: body.decision ?? null,
    analysisReport: body.analysisReport ?? null,
    analysisId: toInt(body.analysisId),
  });
  return NextResponse.json({ vehicle: rows[0] });
}
