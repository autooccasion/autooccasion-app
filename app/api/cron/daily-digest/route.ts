// Daily digest cron — called by Vercel Cron at 07:00 Brussels time.
// Authenticates via CRON_SECRET (injected automatically by Vercel).

import { NextRequest, NextResponse } from 'next/server';
import { getVehicles, getVehicleSummaries, getActiveTenants } from 'app/db';
import { buildDigestEmail } from '@/lib/carmelo/digest-email';
import { sendEmail } from '@/lib/email';
import { computeStockHealth, computePerformanceKPIs } from '@/lib/agents/analytics';

const SLOW_DAYS = 60;

function daysSince(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  return Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 86_400_000));
}

async function runForTenant(email: string): Promise<{ tenant: string; sent: boolean; opportunities: number; error?: string }> {
  const vehicles = await getVehicles(email, 500).catch(() => []);
  const now = Date.now();
  const ms30 = 30 * 86_400_000;

  const newOpportunities = vehicles.filter(
    (v) => v.status === 'analyse' && (v.decision === 'VERT' || v.decision === 'ORANGE'),
  );
  const slowMovers = vehicles.filter((v) => {
    if (v.status !== 'publie') return false;
    const days = daysSince(v.publishedAt);
    return days != null && days > SLOW_DAYS;
  });
  const inStock = vehicles.filter((v) => ['achete', 'en_stock', 'publie'].includes(v.status ?? '')).length;
  const published = vehicles.filter((v) => v.status === 'publie').length;
  const soldLast30 = vehicles.filter((v) =>
    v.status === 'vendu' && v.soldAt != null && now - new Date(v.soldAt).getTime() <= ms30,
  ).length;

  let totalStockValue = 0;
  let avgMarginLast30: number | null = null;
  try {
    const summaries = await getVehicleSummaries(email);
    totalStockValue = computeStockHealth(summaries).totalStockValue;
    avgMarginLast30 = computePerformanceKPIs(summaries).avgMarginLast30;
  } catch (err) {
    console.error(`Cron digest [${email}]: échec analytics`, err);
  }

  const html = buildDigestEmail(
    { newOpportunities, slowMovers, inStock, published, soldLast30, totalStockValue, avgMarginLast30 },
    new Date(),
  );
  const subject = newOpportunities.length > 0
    ? `GP-CARS · ${newOpportunities.length} opportunité${newOpportunities.length > 1 ? 's' : ''} à étudier`
    : `GP-CARS · Bilan du ${new Date().toLocaleDateString('fr-BE')}`;

  const result = await sendEmail({ to: email, subject, html });
  return { tenant: email, sent: result.ok, opportunities: newOpportunities.length, error: result.ok ? undefined : result.error };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const tenants = await getActiveTenants();
  if (tenants.length === 0) {
    return NextResponse.json({ error: 'Aucun garage actif (NOTIFY_EMAIL non configuré et aucun compte).' }, { status: 500 });
  }

  const results = [];
  for (const email of tenants) {
    try {
      results.push(await runForTenant(email));
    } catch (err) {
      console.error(`Cron digest [${email}]: échec`, err);
      results.push({ tenant: email, sent: false, opportunities: 0, error: 'exception' });
    }
  }

  return NextResponse.json({ ok: true, tenants: tenants.length, results });
}
