import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { getSetting, setSetting } from 'app/db';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const key = await getSetting('ANTHROPIC_API_KEY');
  return NextResponse.json({ configured: !!key });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const apiKey = body?.apiKey?.trim();

  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return NextResponse.json(
      { error: 'Clé invalide. Elle doit commencer par sk-ant-' },
      { status: 400 }
    );
  }

  await setSetting('ANTHROPIC_API_KEY', apiKey);
  return NextResponse.json({ success: true });
}
