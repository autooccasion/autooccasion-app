import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { updateWarrantyCase } from 'app/db';
import type { WarrantyCaseStatus, WarrantyCaseSeverity } from 'app/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update: Partial<{
    status: WarrantyCaseStatus;
    severity: WarrantyCaseSeverity;
    estimatedCost: number | null;
    actualCost: number | null;
    resolution: string | null;
    customerResponse: string | null;
    resolvedAt: Date | null;
  }> = {};
  if (body.status !== undefined) {
    update.status = body.status;
    if (body.status === 'resolu' || body.status === 'rejete') update.resolvedAt = new Date();
  }
  if (body.severity !== undefined) update.severity = body.severity;
  if (body.estimatedCost !== undefined) update.estimatedCost = body.estimatedCost ? parseInt(body.estimatedCost, 10) : null;
  if (body.actualCost !== undefined) update.actualCost = body.actualCost ? parseInt(body.actualCost, 10) : null;
  if (body.resolution !== undefined) update.resolution = body.resolution || null;
  if (body.customerResponse !== undefined) update.customerResponse = body.customerResponse || null;
  const rows = await updateWarrantyCase(parseInt(id, 10), session.user.email, update);
  return NextResponse.json({ case: rows[0] ?? null });
}
