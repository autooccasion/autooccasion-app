import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { getGarageConfig, getGarageConfigOverrides, saveGarageConfig } from 'app/db';
import { DEFAULT_GARAGE_CONFIG, type GarageConfigOverrides } from '@/lib/carmelo/garage-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const [config, overrides] = await Promise.all([
    getGarageConfig(session.user.email),
    getGarageConfigOverrides(session.user.email),
  ]);
  return NextResponse.json({ config, overrides, defaults: DEFAULT_GARAGE_CONFIG });
}

function num(v: unknown): number | undefined {
  if (v === '' || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body invalide.' }, { status: 400 });
  }

  // Build a clean overrides object — only keep defined, valid values.
  const overrides: GarageConfigOverrides = {};

  if (typeof body.garageName === 'string' && body.garageName.trim()) {
    overrides.garageName = body.garageName.trim().slice(0, 64);
  }

  const params: NonNullable<GarageConfigOverrides['params']> = {};
  if (num(body.plafondAchat) !== undefined) params.plafond_achat_vehicule = num(body.plafondAchat)!;
  if (num(body.budgetJour) !== undefined) params.budget_max_jour = num(body.budgetJour)!;
  if (num(body.seuilConfiance) !== undefined) params.seuil_confiance_autonome = Math.min(100, num(body.seuilConfiance)!);
  if (num(body.coussinPct) !== undefined) params.coussin_negociation_client_pct = num(body.coussinPct)!;
  if (Object.keys(params).length) overrides.params = params;

  const margins: NonNullable<GarageConfigOverrides['margins']> = {};
  const std: Record<string, number> = {};
  if (num(body.margeStdCible) !== undefined) std.cible = num(body.margeStdCible)!;
  if (num(body.margeStdOrange) !== undefined) { std.orange_min = num(body.margeStdOrange)!; std.rouge_seuil = num(body.margeStdOrange)!; }
  if (Object.keys(std).length) margins.standard = std;
  const prem: Record<string, number> = {};
  if (num(body.margePremCible) !== undefined) prem.cible = num(body.margePremCible)!;
  if (num(body.margePremOrange) !== undefined) { prem.orange_min = num(body.margePremOrange)!; prem.rouge_seuil = num(body.margePremOrange)!; }
  if (Object.keys(prem).length) margins.premium = prem;
  if (Object.keys(margins).length) overrides.margins = margins;

  const cost: NonNullable<GarageConfigOverrides['costReference']> = {};
  if (num(body.ctCarpass) !== undefined) cost.ct_carpass = num(body.ctCarpass)!;
  if (num(body.preparation) !== undefined) cost.preparation_standard = num(body.preparation)!;
  if (num(body.publicite) !== undefined) cost.publicite = num(body.publicite)!;
  if (Object.keys(cost).length) overrides.costReference = cost;

  if (Array.isArray(body.marquesPreferees)) {
    overrides.marquesPreferees = body.marquesPreferees
      .filter((m: unknown): m is string => typeof m === 'string' && m.trim().length > 0)
      .map((m: string) => m.trim().slice(0, 32))
      .slice(0, 40);
  }
  if (Array.isArray(body.exclusionsAbsolues)) {
    overrides.exclusionsAbsolues = body.exclusionsAbsolues
      .filter((m: unknown): m is string => typeof m === 'string' && m.trim().length > 0)
      .map((m: string) => m.trim().slice(0, 80))
      .slice(0, 40);
  }

  await saveGarageConfig(email, overrides);
  const config = await getGarageConfig(email);
  return NextResponse.json({ ok: true, config });
}
