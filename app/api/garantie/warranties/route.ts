import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { createWarranty, getWarranties } from 'app/db';

export async function GET(req: NextRequest) {
  void req;
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const warranties = await getWarranties(session.user.email);
  return NextResponse.json({ warranties });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.vehicleId || !body?.soldAt) return NextResponse.json({ error: 'vehicleId et soldAt requis.' }, { status: 400 });
  const rows = await createWarranty(session.user.email, {
    vehicleId: body.vehicleId,
    buyerName: body.buyerName ?? null,
    buyerEmail: body.buyerEmail ?? null,
    buyerPhone: body.buyerPhone ?? null,
    buyerType: body.buyerType ?? 'particulier',
    warrantyType: body.warrantyType ?? 'legale',
    soldPrice: body.soldPrice ? parseInt(body.soldPrice, 10) : null,
    soldAt: new Date(body.soldAt),
    contractMonths: body.contractMonths ? parseInt(body.contractMonths, 10) : null,
    notes: body.notes ?? null,
  });
  return NextResponse.json({ warranty: rows[0] });
}
