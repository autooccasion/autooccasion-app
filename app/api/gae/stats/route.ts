import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { getGaeStats } from 'app/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const stats = await getGaeStats(session.user.email);
  return NextResponse.json({ stats });
}
