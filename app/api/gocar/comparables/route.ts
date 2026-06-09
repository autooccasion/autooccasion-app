import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { fetchGocarComparables } from '@/lib/gocar/client';

// Returns market comparables for a given vehicle from GoCar B2B API.
// Used by /carmelo/marche to auto-fill comparables when GOCAR_API_KEY is set.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const make: string = body?.make ?? '';
  if (!make) return NextResponse.json({ error: 'Marque requise.' }, { status: 400 });

  const result = await fetchGocarComparables({
    make,
    model:   body?.model,
    yearMin: body?.yearMin,
    yearMax: body?.yearMax,
    kmMax:   body?.kmMax,
    fuel:    body?.fuel,
    gearbox: body?.gearbox,
    limit:   20,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, gocarActive: false }, { status: 503 });
  }

  const prices = result.comparables.map((c) => c.price).filter((p) => p > 0);
  return NextResponse.json({
    gocarActive: true,
    comparables: result.comparables,
    prices,
    count: prices.length,
  });
}
