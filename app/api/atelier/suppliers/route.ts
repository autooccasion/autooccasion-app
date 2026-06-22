import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { getSuppliers, createSupplier } from 'app/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const suppliers = await getSuppliers(session.user.email);
  return NextResponse.json({ suppliers });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const body = await req.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ error: 'Nom requis.' }, { status: 400 });

  const rows = await createSupplier(email, {
    name: body.name,
    phone: body.phone ?? null,
    contactEmail: body.contactEmail ?? null,
    type: body.type ?? null,
    notes: body.notes ?? null,
  });
  return NextResponse.json({ supplier: rows[0] });
}
