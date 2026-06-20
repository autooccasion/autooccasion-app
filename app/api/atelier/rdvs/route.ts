import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { createRdv, getUpcomingRdvs, updateRdvStatus } from 'app/db';
import type { RdvType, RdvStatus } from '@/lib/agents/shared-types';

const VALID_RDV_TYPES: RdvType[] = ['diagnostic', 'intervention', 'livraison', 'reprise_trade_in', 'essai'];
const VALID_RDV_STATUSES: RdvStatus[] = ['planifie', 'confirme', 'annule', 'termine'];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get('days') ?? '14');
  const rdvs = await getUpcomingRdvs(session.user.email, days);
  return NextResponse.json({ rdvs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });

  if (body.action === 'update_status' && typeof body.id === 'number' && typeof body.status === 'string') {
    if (!VALID_RDV_STATUSES.includes(body.status as RdvStatus)) {
      return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
    }
    await updateRdvStatus(body.id, email, body.status as RdvStatus);
    return NextResponse.json({ ok: true });
  }

  if (!body.type || !VALID_RDV_TYPES.includes(body.type as RdvType)) {
    return NextResponse.json({ error: 'Type de RDV invalide.' }, { status: 400 });
  }
  if (!body.scheduledAt) {
    return NextResponse.json({ error: 'scheduledAt requis.' }, { status: 400 });
  }

  const rdv = await createRdv(email, {
    vehicleId: body.vehicleId ?? null,
    leadId: body.leadId ?? null,
    interventionId: body.interventionId ?? null,
    customerName: body.customerName ?? null,
    customerPhone: body.customerPhone ?? null,
    customerEmail: body.customerEmail ?? null,
    type: body.type as RdvType,
    scheduledAt: new Date(body.scheduledAt),
    durationMinutes: body.durationMinutes ?? 60,
    notes: body.notes ?? null,
  });
  return NextResponse.json({ rdv });
}
