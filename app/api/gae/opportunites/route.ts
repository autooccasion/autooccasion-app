import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { createGaeOpportunite, getGaeOpportunites, getGaeOpportunite, updateGaeOpportunite, getGaeHistory } from 'app/db';
import type { GaeOpportuniteType, GaeAgentSource, GaeStatus } from '@/lib/agents/shared-types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) {
    const opp  = await getGaeOpportunite(Number(id), session.user.email);
    if (!opp) return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
    const history = await getGaeHistory(opp.id, session.user.email);
    return NextResponse.json({ opportunite: opp, history });
  }
  const type   = searchParams.get('type') as GaeOpportuniteType | null;
  const status = searchParams.get('status') as GaeStatus | null;
  const opps   = await getGaeOpportunites(session.user.email, type ?? undefined, status ?? undefined);
  return NextResponse.json({ opportunites: opps });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;
  const body  = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body requis.' }, { status: 400 });

  if (body.action === 'update') {
    await updateGaeOpportunite(Number(body.id), email, body.update ?? {}, email);
    return NextResponse.json({ ok: true });
  }

  const opp = await createGaeOpportunite({
    email,
    type:        body.type as GaeOpportuniteType,
    agentSource: (body.agentSource ?? 'manuel') as GaeAgentSource,
    title:       body.title ?? null,
    estimatedValue:       body.estimatedValue ?? null,
    marginEstimated:      body.marginEstimated ?? null,
    attributionConfidence: body.attributionConfidence ?? 100,
    vehicleMake:  body.vehicleMake ?? null,
    vehicleModel: body.vehicleModel ?? null,
    vehicleYear:  body.vehicleYear ?? null,
    listingUrl:   body.listingUrl ?? null,
  });
  return NextResponse.json({ ok: true, gaeId: opp.gaeId, id: opp.id });
}
