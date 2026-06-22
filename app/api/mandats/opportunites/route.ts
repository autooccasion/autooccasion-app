import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import {
  createMandatOpportunite, getMandatOpportunites, getMandatOpportunite,
  updateMandatOpportunite, addMandatContact, getMandatContacts, publishEvent,
} from 'app/db';
import type { MandatStatus, ContactCanal, ContactResultat } from '@/lib/agents/shared-types';
import { assertBody, optionalString, optionalPositiveInt } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) {
    const opp = await getMandatOpportunite(Number(id), session.user.email);
    if (!opp) return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
    const contacts = await getMandatContacts(opp.id);
    return NextResponse.json({ opportunite: opp, contacts });
  }
  const status = searchParams.get('status') as MandatStatus | null;
  const opps = await getMandatOpportunites(session.user.email, status ?? undefined);
  return NextResponse.json({ opportunites: opps });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;
  const body = await req.json().catch(() => null);
  assertBody(body);

  const action = optionalString(body.action) ?? 'create';

  if (action === 'update_status') {
    const id = body.id as number;
    const status = body.status as MandatStatus;
    await updateMandatOpportunite(id, email, { status });
    if (status === 'mandat') {
      await publishEvent('mandats.mandat_signe', 'mandats', { opportuniteId: id }, email);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'update_notes') {
    await updateMandatOpportunite(body.id as number, email, { internalNotes: body.notes as string });
    return NextResponse.json({ ok: true });
  }

  if (action === 'add_contact') {
    const contact = await addMandatContact(body.opportuniteId as number, email, {
      canal:          body.canal as ContactCanal,
      messageEnvoye:  optionalString(body.messageEnvoye),
      reponseObtenue: optionalString(body.reponseObtenue),
      resultat:       (body.resultat as ContactResultat) ?? null,
    });
    if (body.resultat === 'pas_reponse' || body.resultat === 'interesse') {
      await updateMandatOpportunite(body.opportuniteId as number, email, { status: 'contacte' });
    }
    if (body.resultat === 'rdv_fixe') {
      await updateMandatOpportunite(body.opportuniteId as number, email, { status: 'rdv' });
    }
    if (body.resultat === 'mandat_signe') {
      await updateMandatOpportunite(body.opportuniteId as number, email, { status: 'mandat' });
      await publishEvent('mandats.mandat_signe', 'mandats', { opportuniteId: body.opportuniteId as number }, email);
    }
    return NextResponse.json({ ok: true, contact });
  }

  // Default: create
  const opp = await createMandatOpportunite(email, {
    source:       optionalString(body.source) ?? 'manuel',
    listingUrl:   optionalString(body.listingUrl),
    listingTitle: optionalString(body.listingTitle),
    make:         optionalString(body.make),
    model:        optionalString(body.model),
    year:         optionalPositiveInt(body.year),
    km:           optionalPositiveInt(body.km),
    fuel:         optionalString(body.fuel),
    gearbox:      optionalString(body.gearbox),
    askingPrice:  optionalPositiveInt(body.askingPrice),
    location:     optionalString(body.location),
    sellerName:   optionalString(body.sellerName),
    sellerPhone:  optionalString(body.sellerPhone),
  });
  await publishEvent('mandats.opportunite_detectee', 'mandats', { opportuniteId: opp.id }, email);
  return NextResponse.json({ ok: true, opportunite: opp });
}
