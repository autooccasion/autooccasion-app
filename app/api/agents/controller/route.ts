import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from 'app/auth';
import { cookies } from 'next/headers';
import { getVehicle, saveControllerResult, getVehicleSummaries } from 'app/db';
import { buildControllerSystemPrompt, runHardRules } from '@/lib/agents/controller/system-prompt';
import type { VehicleSummary } from '@/lib/agents/shared-types';
import { computeSurstockRisk, computeBudgetDisponible } from '@/lib/agents/analytics';
import { GP_CARS_PARAMS } from '@/lib/carmelo/config';
import { requirePositiveInt, ValidationError } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  const rl = checkRateLimit(`controller:${email}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || cookies().get('gp_api_key')?.value;
  if (!apiKey) return NextResponse.json({ error: 'Clé API non configurée.' }, { status: 500 });

  const rawBody = await req.json().catch(() => null);
  let vehicleId: number;
  try {
    vehicleId = requirePositiveInt(rawBody?.vehicleId, 'vehicleId');
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: 'vehicleId invalide.' }, { status: 400 });
  }

  const row = await getVehicle(vehicleId, email);
  if (!row) return NextResponse.json({ error: 'Véhicule introuvable.' }, { status: 404 });

  const summary: VehicleSummary = {
    id: row.id,
    make: row.make ?? null,
    model: row.model ?? null,
    year: row.year ?? null,
    km: row.km ?? null,
    fuel: row.fuel ?? null,
    status: (row.status ?? 'analyse') as VehicleSummary['status'],
    askingPrice: row.askingPrice ?? null,
    maxBuyPrice: row.maxBuyPrice ?? null,
    realBuyPrice: row.realBuyPrice ?? null,
    realSellPrice: row.realSellPrice ?? null,
    decision: (row.decision ?? 'INCONNU') as VehicleSummary['decision'],
    soldInDays: row.soldInDays ?? null,
    realMargin: row.realMargin ?? null,
    publishedAt: row.publishedAt ?? null,
    soldAt: row.soldAt ?? null,
  };

  // 0. TTL — analyse de plus de 72h → avertissement (prix de marché potentiellement périmé).
  const analysisAgeMs = row.createdAt ? Date.now() - new Date(row.createdAt).getTime() : 0;
  const ttlFlag = analysisAgeMs > 72 * 3_600_000
    ? [{
        code: 'ANALYSE_PERIMEE',
        severity: 'avertissement',
        message: `Analyse réalisée il y a ${Math.round(analysisAgeMs / 3_600_000)}h. Vérifiez que le véhicule est toujours disponible et que le prix de marché n'a pas évolué.`,
      }]
    : [];

  // 1a. Surstock + budget — vérifications transversales (sans LLM).
  const contextFlags: { code: string; severity: string; message: string }[] = [];
  try {
    const summaries = await getVehicleSummaries(email);

    const surstock = computeSurstockRisk(summaries, row.make, 2);
    if (surstock?.isRisky) {
      contextFlags.push({
        code: 'SURSTOCK_MARQUE',
        severity: 'avertissement',
        message: surstock.message,
      });
    }

    const budget = computeBudgetDisponible(summaries, GP_CARS_PARAMS.budget_max_jour);
    if (budget.isExhausted) {
      contextFlags.push({
        code: 'BUDGET_JOURNALIER_EPUISE',
        severity: 'bloquant',
        message: `Budget journalier épuisé — capital engagé ${budget.capitalEngage.toLocaleString('fr-BE')} € sur ${budget.budgetJournalier.toLocaleString('fr-BE')} € maximum.`,
      });
    } else if (budget.isConstrained && row.maxBuyPrice != null && row.maxBuyPrice > budget.budgetRestant) {
      contextFlags.push({
        code: 'BUDGET_JOURNALIER_INSUFFISANT',
        severity: 'avertissement',
        message: `Trésorerie contrainte — budget restant ${budget.budgetRestant.toLocaleString('fr-BE')} € < prix max conseillé ${row.maxBuyPrice.toLocaleString('fr-BE')} €.`,
      });
    }
  } catch (err) {
    console.error('Contrôleur: échec vérification surstock/budget', err);
  }

  // 1b. Règles dures — synchrones, sans LLM.
  const hardFlags = [...ttlFlag, ...contextFlags, ...runHardRules(summary)];
  const hasBlocker = hardFlags.some((f) => f.severity === 'bloquant');

  let llmFlags: { code: string; severity: string; message: string }[] = [];
  let llmSummary = '';
  let requiresHuman = (row.confidence ?? 100) < 85;

  // 2. LLM uniquement si aucun bloquant (économie de tokens).
  if (!hasBlocker) {
    const client = new Anthropic({ apiKey });
    const userMessage = JSON.stringify({
      vehicule: `${row.make || ''} ${row.model || ''} ${row.year || ''}`.trim(),
      km: row.km,
      askingPrice: row.askingPrice,
      maxBuyPrice: row.maxBuyPrice,
      realBuyPrice: row.realBuyPrice,
      marketPrice: row.marketPrice,
      estimatedMargin: row.estimatedMargin,
      confidence: row.confidence,
      decision: row.decision,
      listingTitle: row.listingTitle,
      listingDescription: row.listingDescription?.slice(0, 200),
    });

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        system: buildControllerSystemPrompt(),
        messages: [{ role: 'user', content: userMessage }],
      });
      const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const parsed = JSON.parse(text);
      llmFlags = parsed.flags || [];
      llmSummary = parsed.summary || '';
      requiresHuman = requiresHuman || parsed.requires_human_validation === true;
    } catch (err) {
      console.error('Agent contrôleur: erreur LLM', err);
    }
  }

  const allFlags = [...hardFlags, ...llmFlags];
  const validated = !allFlags.some((f) => f.severity === 'bloquant');

  await saveControllerResult(vehicleId, email, {
    validated,
    requiresHuman,
    flags: allFlags as any,
    notes: llmSummary,
  });

  return NextResponse.json({ validated, requiresHuman, flags: allFlags, summary: llmSummary });
}
