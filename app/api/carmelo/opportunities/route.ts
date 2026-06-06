import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { saveOpportunity } from 'app/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const vehicule = typeof body?.vehicule === 'string' ? body.vehicule.trim() : '';
  if (!vehicule) {
    return NextResponse.json({ error: 'Véhicule manquant.' }, { status: 400 });
  }

  const toInt = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };

  try {
    await saveOpportunity(session.user.email, {
      vehicule,
      url: typeof body?.url === 'string' ? body.url : null,
      askingPrice: toInt(body?.askingPrice),
      targetSell: toInt(body?.targetSell),
      maxBuy: toInt(body?.maxBuy),
      marginAtAsk: toInt(body?.marginAtAsk),
      zone: typeof body?.zone === 'string' ? body.zone : null,
      positioning: typeof body?.positioning === 'string' ? body.positioning : null,
      contactMessage: typeof body?.contactMessage === 'string' ? body.contactMessage : null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Carmelo: échec sauvegarde opportunité', err);
    return NextResponse.json({ error: "Échec de l'enregistrement." }, { status: 500 });
  }
}
