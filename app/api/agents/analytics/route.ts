import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { getVehicleSummaries } from 'app/db';
import {
  computeMakeStats,
  computeStockHealth,
  computePerformanceKPIs,
} from '@/lib/agents/analytics';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  const summaries = await getVehicleSummaries(session.user.email);

  return NextResponse.json({
    makeStats: computeMakeStats(summaries),
    stockHealth: computeStockHealth(summaries),
    kpis: computePerformanceKPIs(summaries),
  });
}
