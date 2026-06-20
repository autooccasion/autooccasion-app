import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { addPieceCommande, updatePieceStatus, getPiecesForIntervention } from 'app/db';
import type { PieceStatus } from '@/lib/agents/shared-types';

const VALID_PIECE_STATUSES: PieceStatus[] = ['a_commander', 'commande', 'recu', 'monte'];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const interventionId = Number(searchParams.get('interventionId'));
  if (!interventionId) return NextResponse.json({ error: 'interventionId requis.' }, { status: 400 });

  const pieces = await getPiecesForIntervention(interventionId);
  return NextResponse.json({ pieces });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });

  if (body.action === 'update_status' && typeof body.id === 'number' && typeof body.status === 'string') {
    if (!VALID_PIECE_STATUSES.includes(body.status as PieceStatus)) {
      return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
    }
    await updatePieceStatus(body.id, email, body.status as PieceStatus);
    return NextResponse.json({ ok: true });
  }

  if (typeof body.interventionId !== 'number' || typeof body.pieceName !== 'string') {
    return NextResponse.json({ error: 'interventionId et pieceName requis.' }, { status: 400 });
  }
  const piece = await addPieceCommande(body.interventionId, email, {
    pieceName: body.pieceName,
    partNumber: body.partNumber ?? null,
    supplier: body.supplier ?? null,
    estimatedPrice: body.estimatedPrice ?? null,
    quantity: body.quantity ?? 1,
    supplierMessage: body.supplierMessage ?? null,
  });
  return NextResponse.json({ piece });
}
