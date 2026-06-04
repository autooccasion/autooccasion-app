// Daily digest cron — called by Vercel Cron at 07:00 Brussels time.
// Authenticates via CRON_SECRET (injected automatically by Vercel).

import { NextRequest, NextResponse } from 'next/server';
import { getVehicles } from 'app/db';
import { buildDigestEmail } from '@/lib/carmelo/digest-email';
import { sendEmail } from '@/lib/email';
import type { VehicleRecord } from 'app/db';

const SLOW_DAYS = 60;

function daysSince(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  return Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 86_400_000));
}

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret (prevents unauthorized calls).
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) {
    return NextResponse.json({ error: 'NOTIFY_EMAIL non configuré.' }, { status: 500 });
  }

  let vehicles: VehicleRecord[] = [];
  try {
    vehicles = await getVehicles(notifyEmail, 500);
  } catch (err) {
    console.error('Cron digest: échec chargement véhicules', err);
    return NextResponse.json({ error: 'Impossible de charger les véhicules.' }, { status: 500 });
  }

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

  const inStock = vehicles.filter((v) =>
    ['achete', 'en_stock', 'publie'].includes(v.status ?? ''),
  ).length;

  const published = vehicles.filter((v) => v.status === 'publie').length;

  const soldLast30 = vehicles.filter((v) => {
    return v.status === 'vendu' && v.soldAt != null &&
      now - new Date(v.soldAt).getTime() <= ms30;
  }).length;

  const html = buildDigestEmail(
    { newOpportunities, slowMovers, inStock, published, soldLast30 },
    new Date(),
  );

  const subject = newOpportunities.length > 0
    ? `GP-CARS · ${newOpportunities.length} opportunité${newOpportunities.length > 1 ? 's' : ''} à étudier`
    : `GP-CARS · Bilan du ${new Date().toLocaleDateString('fr-BE')}`;

  const result = await sendEmail({ to: notifyEmail, subject, html });

  if (!result.ok) {
    console.error('Cron digest: échec envoi email', result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    sent: true,
    to: notifyEmail,
    opportunities: newOpportunities.length,
    slowMovers: slowMovers.length,
  });
}
