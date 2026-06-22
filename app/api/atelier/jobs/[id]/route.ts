import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { updateWorkshopJob, deleteWorkshopJob } from 'app/db';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;
  const id = parseInt(params.id, 10);

  const body = await req.json().catch(() => ({}));
  const update: Parameters<typeof updateWorkshopJob>[2] = {};
  if (body.status !== undefined) update.status = body.status;
  if (body.actualCost !== undefined) update.actualCost = body.actualCost ? parseInt(body.actualCost, 10) : null;
  if (body.supplier !== undefined) update.supplier = body.supplier || null;
  if (body.estimatedCost !== undefined) update.estimatedCost = body.estimatedCost ? parseInt(body.estimatedCost, 10) : null;
  if (body.scheduledAt !== undefined) update.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (body.description !== undefined) update.description = body.description || null;
  if (body.status === 'termine') update.completedAt = new Date();

  const rows = await updateWorkshopJob(id, email, update);
  return NextResponse.json({ job: rows[0] ?? null });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;
  await deleteWorkshopJob(parseInt(params.id, 10), email);
  return NextResponse.json({ ok: true });
}
