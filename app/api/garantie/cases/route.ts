import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { createWarrantyCase, getOpenWarrantyCases, getWarrantyCases } from 'app/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const warrantyId = req.nextUrl.searchParams.get('warrantyId');
  if (warrantyId) {
    const cases = await getWarrantyCases(parseInt(warrantyId, 10), session.user.email);
    return NextResponse.json({ cases });
  }
  const cases = await getOpenWarrantyCases(session.user.email);
  return NextResponse.json({ cases });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.warrantyId || !body?.description) return NextResponse.json({ error: 'warrantyId et description requis.' }, { status: 400 });
  const rows = await createWarrantyCase(session.user.email, {
    warrantyId: body.warrantyId,
    description: body.description,
    severity: body.severity ?? 'modere',
    estimatedCost: body.estimatedCost ? parseInt(body.estimatedCost, 10) : null,
  });
  return NextResponse.json({ case: rows[0] });
}
