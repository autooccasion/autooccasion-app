import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import {
  computeStats,
  evaluateOpportunity,
  positionPrice,
  POSITIONING_LABELS,
} from '@/lib/carmelo/market';
import { getGarageConfig } from 'app/db';

// Pure market study — no AI, no external data. The caller provides the asking
// price and a list of comparable market prices (from any source).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const askingPrice = Number(body?.askingPrice);
  const comparables: number[] = Array.isArray(body?.comparables)
    ? body.comparables.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n) && n > 0)
    : [];

  if (!Number.isFinite(askingPrice) || askingPrice <= 0) {
    return NextResponse.json({ error: 'Prix demandé invalide.' }, { status: 400 });
  }

  const stats = computeStats(comparables);
  if (!stats) {
    return NextResponse.json(
      { error: 'Pas assez de comparables fiables (minimum 3 prix).' },
      { status: 422 },
    );
  }

  const config = await getGarageConfig(session.user.email);
  const opportunity = evaluateOpportunity(askingPrice, stats, config);

  return NextResponse.json({
    opportunity,
    labels: {
      asking: POSITIONING_LABELS[positionPrice(askingPrice, stats)],
      target: POSITIONING_LABELS[opportunity.targetPositioning],
    },
  });
}
