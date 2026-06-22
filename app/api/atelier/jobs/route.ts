import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { createWorkshopJob, getWorkshopJobsByVehicle, getOpenWorkshopJobs } from 'app/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const vehicleId = req.nextUrl.searchParams.get('vehicleId');
  if (vehicleId) {
    const jobs = await getWorkshopJobsByVehicle(parseInt(vehicleId, 10), email);
    return NextResponse.json({ jobs });
  }
  const jobs = await getOpenWorkshopJobs(email);
  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const body = await req.json().catch(() => null);
  if (!body?.vehicleId || !body?.type) {
    return NextResponse.json({ error: 'vehicleId et type requis.' }, { status: 400 });
  }

  const rows = await createWorkshopJob(email, {
    vehicleId: body.vehicleId,
    type: body.type,
    description: body.description ?? null,
    supplier: body.supplier ?? null,
    estimatedCost: body.estimatedCost ? parseInt(body.estimatedCost, 10) : null,
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
  });
  return NextResponse.json({ job: rows[0] });
}
