import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import {
  getAtelierInterventions,
  updateAtelierIntervention,
  createAtelierIntervention,
} from 'app/db';
import type { AtelierInterventionStatus, AtelierInterventionType } from '@/lib/agents/shared-types';

const VALID_STATUSES: AtelierInterventionStatus[] = ['planifie', 'en_cours', 'termine', 'facture'];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  const interventions = await getAtelierInterventions(session.user.email);
  return NextResponse.json({ interventions });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });

  // Update existing intervention
  if (body.action === 'update' && typeof body.id === 'number') {
    const updates: Record<string, unknown> = {};
    if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status as AtelierInterventionStatus)) {
      updates.status = body.status;
      if (body.status === 'en_cours') updates.startDate = new Date();
      if (body.status === 'termine' || body.status === 'facture') updates.endDate = new Date();
    }
    if (typeof body.mecanicNotes === 'string') updates.mecanicNotes = body.mecanicNotes;
    if (typeof body.realCost === 'number') updates.realCost = body.realCost;
    if (typeof body.estimatedCost === 'number') updates.estimatedCost = body.estimatedCost;
    if (typeof body.description === 'string') updates.description = body.description;
    if (typeof body.estimatedDuration === 'number') updates.estimatedDuration = body.estimatedDuration;

    await updateAtelierIntervention(body.id, email, updates as Parameters<typeof updateAtelierIntervention>[2]);
    return NextResponse.json({ ok: true });
  }

  // Create new intervention manually
  if (typeof body.vehicleId !== 'number') {
    return NextResponse.json({ error: 'vehicleId requis.' }, { status: 400 });
  }
  const intervention = await createAtelierIntervention(
    body.vehicleId,
    email,
    (body.type as AtelierInterventionType) ?? 'preparation_vente',
    body.description ?? null,
    null,
  );
  return NextResponse.json({ intervention });
}
