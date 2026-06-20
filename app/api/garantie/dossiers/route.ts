import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import {
  createGarantieDossier, getGarantieDossiers, getGarantieDossier,
  updateGarantieDossier, addGarantieDocument, getGarantieDocuments,
} from 'app/db';
import type { GarantieStatus, GarantieDocumentType } from '@/lib/agents/shared-types';
import { publishEvent } from 'app/db';

const VALID_STATUSES: GarantieStatus[] = [
  'nouveau','en_analyse','decision_prise','sav_en_cours','resolu','litige','expertise','procedure',
];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (id) {
    const dossier = await getGarantieDossier(Number(id), session.user.email);
    if (!dossier) return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 });
    const documents = await getGarantieDocuments(dossier.id);
    return NextResponse.json({ dossier, documents });
  }

  const dossiers = await getGarantieDossiers(session.user.email);
  return NextResponse.json({ dossiers });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });

  // Update dossier
  if (body.action === 'update' && typeof body.id === 'number') {
    const updates: Record<string, unknown> = {};
    if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status as GarantieStatus)) {
      updates.status = body.status;
    }
    if (typeof body.internalNotes === 'string') updates.internalNotes = body.internalNotes;
    if (typeof body.diagnosis === 'string') updates.diagnosis = body.diagnosis;
    if (typeof body.finalCost === 'number') updates.finalCost = body.finalCost;
    if (typeof body.coverageDecision === 'string') updates.coverageDecision = body.coverageDecision;
    if (typeof body.coveragePercent === 'number') updates.coveragePercent = body.coveragePercent;
    if (typeof body.clientContribution === 'number') updates.clientContribution = body.clientContribution;

    await updateGarantieDossier(body.id, email, updates as Parameters<typeof updateGarantieDossier>[2]);

    if (body.status === 'litige') {
      await publishEvent('garantie.litige_detecte', 'garantie', { dossierId: body.id });
    }
    return NextResponse.json({ ok: true });
  }

  // Add document
  if (body.action === 'add_document' && typeof body.dossierId === 'number') {
    if (!body.type || !body.title) {
      return NextResponse.json({ error: 'type et title requis.' }, { status: 400 });
    }
    const doc = await addGarantieDocument(body.dossierId, email, {
      type: body.type as GarantieDocumentType,
      title: body.title,
      description: body.description ?? null,
      fileUrl: body.fileUrl ?? null,
      addedBy: body.addedBy ?? 'garage',
      notes: body.notes ?? null,
    });
    return NextResponse.json({ document: doc });
  }

  // Create new dossier
  const dossier = await createGarantieDossier(email, {
    vehicleId:              body.vehicleId ?? null,
    vehicleMake:            body.vehicleMake ?? null,
    vehicleModel:           body.vehicleModel ?? null,
    vehicleYear:            body.vehicleYear ?? null,
    vehicleVin:             body.vehicleVin ?? null,
    vehicleKmAtSale:        body.vehicleKmAtSale ?? null,
    vehicleKmNow:           body.vehicleKmNow ?? null,
    saleDate:               body.saleDate ? new Date(body.saleDate) : null,
    invoiceNumber:          body.invoiceNumber ?? null,
    warrantyDurationMonths: body.warrantyDurationMonths ?? 12,
    customerName:           body.customerName ?? null,
    customerPhone:          body.customerPhone ?? null,
    customerEmail:          body.customerEmail ?? null,
    claimDate:              body.claimDate ? new Date(body.claimDate) : new Date(),
    claimDescription:       body.claimDescription ?? null,
    symptoms:               body.symptoms ?? null,
    usageType:              body.usageType ?? null,
    maintenanceOk:          body.maintenanceOk ?? null,
    internalNotes:          body.internalNotes ?? null,
  });

  await publishEvent('garantie.dossier_cree', 'garantie', {
    dossierId: dossier.id,
    vehicleMake: dossier.vehicleMake,
    vehicleModel: dossier.vehicleModel,
    customerName: dossier.customerName,
  });

  return NextResponse.json({ dossier });
}
