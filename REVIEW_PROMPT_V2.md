# PROMPT DE REVUE — GP-CARS MULTI-AGENTS v2

Tu es un architecte logiciel senior spécialisé en Next.js 14 App Router, TypeScript strict, Drizzle ORM, systèmes multi-agents IA, et architecture SaaS B2B.

Je te soumets la base de code complète de **GP-CARS**, un système multi-agents pour un garage automobile belge (Francisco & Michael, Soumagne). Le système a trois agents IA qui **partagent une base de données commune** — la table `Vehicle` est la **source de vérité unique**.

---

## CE QUE JE VEUX

1. **Audit bugs & correctness** — erreurs silencieuses, cas limites, comportements inattendus en production.
2. **Audit sécurité** — SSRF, injections, fuites de données, RGPD, surface d'attaque.
3. **Audit architecture multi-agents** — les 3 agents sont-ils bien découplés ? Y a-t-il des risques de race conditions, de double écriture, d'état incohérent entre agents ?
4. **Audit performance** — requêtes N+1, cold starts, hot paths non cachés.
5. **Audit UX / métier** — manques fonctionnels qui bloqueront l'usage quotidien réel d'un garage.

**Pour chaque problème : fichier + ligne approximative + sévérité (🔴 critique / 🟠 élevé / 🟡 moyen / 🔵 faible) + correctif TypeScript complet.**

---

## CONTEXTE MÉTIER

GP-CARS vend des voitures d'occasion. Le flux complet :
```
Annonce détectée → Analyse Carmelo (Agent Achats) → Vehicle créé en DB
→ Agent Contrôleur valide les chiffres
→ Achat réel (realBuyPrice, boughtAt)
→ Agent Marketing rédige l'annonce
→ Publication sur AutoScout24 / Gocar
→ Vente détectée (realSellPrice, soldAt)
→ Marge réelle calculée, jours en stock enregistrés
→ Analytics alimentent les prochains achats
```

**Stack :** Next.js 14 App Router · TypeScript strict · Drizzle ORM · PostgreSQL (Vercel Postgres) · NextAuth v5 beta · Anthropic SDK (claude-opus-4-8) · Tailwind · Vitest

---

## CODE COMPLET

---

### `lib/agents/shared-types.ts`
```typescript
export type VehicleStatus =
  | 'prospect' | 'analyse' | 'achete' | 'en_stock' | 'publie' | 'vendu' | 'refuse';

export type AgentDecision = 'VERT' | 'ORANGE' | 'ROUGE' | 'INCONNU';

export type ControllerFlag = {
  code: string;
  severity: 'bloquant' | 'avertissement' | 'info';
  message: string;
};

export type VehicleSummary = {
  id: number;
  make: string | null; model: string | null; year: number | null;
  km: number | null; fuel: string | null;
  status: VehicleStatus;
  askingPrice: number | null; maxBuyPrice: number | null;
  realBuyPrice: number | null; realSellPrice: number | null;
  decision: AgentDecision;
  soldInDays: number | null; realMargin: number | null;
};
```

---

### `lib/agents/analytics.ts`
```typescript
import type { VehicleSummary } from './shared-types';

export type MakeStats = {
  make: string; count: number; sold: number;
  avgMargin: number | null; avgDays: number | null; conversionRate: number;
};
export type StockHealth = {
  total: number; inStock: number; published: number; sold: number; refused: number;
  avgDaysInStock: number | null; slowVehicles: VehicleSummary[]; totalStockValue: number;
};
export type PerformanceKPIs = {
  soldLast30: number; soldLast7: number;
  avgMarginLast30: number | null; avgRotationLast30: number | null;
  bestMake: string | null; worstMake: string | null; weeklyBuyTarget: number;
};

function avg(nums: number[]): number | null {
  const valid = nums.filter((n) => Number.isFinite(n));
  if (!valid.length) return null;
  return Math.round(valid.reduce((s, n) => s + n, 0) / valid.length);
}

function daysSince(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const ms = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function computeMakeStats(vehicles: VehicleSummary[]): MakeStats[] {
  const byMake = new Map<string, VehicleSummary[]>();
  for (const v of vehicles) {
    const key = v.make || 'Inconnue';
    if (!byMake.has(key)) byMake.set(key, []);
    byMake.get(key)!.push(v);
  }
  return Array.from(byMake.entries())
    .map(([make, list]) => {
      const purchased = list.filter((v) => ['achete','en_stock','publie','vendu'].includes(v.status));
      const sold = list.filter((v) => v.status === 'vendu');
      return {
        make, count: purchased.length, sold: sold.length,
        avgMargin: avg(sold.map((v) => v.realMargin).filter((m): m is number => m != null)),
        avgDays: avg(sold.map((v) => v.soldInDays).filter((d): d is number => d != null)),
        conversionRate: purchased.length > 0 ? Math.round((sold.length / purchased.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function computeStockHealth(vehicles: VehicleSummary[], slowThresholdDays = 60): StockHealth {
  const inStock   = vehicles.filter((v) => ['achete','en_stock','publie'].includes(v.status));
  const published = vehicles.filter((v) => v.status === 'publie');
  const sold      = vehicles.filter((v) => v.status === 'vendu');
  const refused   = vehicles.filter((v) => v.status === 'refuse');
  const slowVehicles = published.filter((v) => {
    const days = daysSince((v as any).publishedAt);
    return days != null && days > slowThresholdDays;
  });
  return {
    total: vehicles.length, inStock: inStock.length, published: published.length,
    sold: sold.length, refused: refused.length,
    avgDaysInStock: avg(sold.map((v) => v.soldInDays).filter((d): d is number => d != null)),
    slowVehicles,
    totalStockValue: inStock.reduce((s, v) => s + (v.realBuyPrice || 0), 0),
  };
}

export function computePerformanceKPIs(vehicles: VehicleSummary[], targetStockLevel = 10): PerformanceKPIs {
  const now = Date.now();
  const sold = vehicles.filter((v) => v.status === 'vendu');
  const soldLast30 = sold.filter((v) => (v as any).soldAt && now - new Date((v as any).soldAt).getTime() <= 30 * 86_400_000);
  const soldLast7  = sold.filter((v) => (v as any).soldAt && now - new Date((v as any).soldAt).getTime() <= 7  * 86_400_000);
  const makeStats = computeMakeStats(vehicles).filter((m) => m.sold >= 2);
  const bestMake  = [...makeStats].sort((a, b) => (b.avgMargin || 0) - (a.avgMargin || 0))[0]?.make || null;
  const worstMake = [...makeStats].sort((a, b) => (a.avgMargin || 0) - (b.avgMargin || 0))[0]?.make || null;
  const avgSoldPerWeek = soldLast30.length / 4;
  const currentStock = vehicles.filter((v) => ['achete','en_stock','publie'].includes(v.status)).length;
  const deficit = Math.max(0, targetStockLevel - currentStock);
  return {
    soldLast30: soldLast30.length, soldLast7: soldLast7.length,
    avgMarginLast30: avg(soldLast30.map((v) => v.realMargin).filter((m): m is number => m != null)),
    avgRotationLast30: avg(soldLast30.map((v) => v.soldInDays).filter((d): d is number => d != null)),
    bestMake, worstMake,
    weeklyBuyTarget: Math.ceil(avgSoldPerWeek + deficit / 2),
  };
}
```

---

### `lib/agents/marketing/system-prompt.ts`
```typescript
export type ListingDraftInput = {
  make: string | null; model: string | null; year: number | null; km: number | null;
  fuel: string | null; gearbox: string | null; color: string | null; power: string | null;
  equipment: string | null; condition: string | null; maintenanceHistory: string | null;
  warranty: string | null; targetSellPrice: number | null; listingUrl: string | null;
};

export function buildMarketingSystemPrompt(): string {
  return `Tu es l'Agent Marketing de GP-CARS (garage à Soumagne, Belgique).
Ta mission est de rédiger des annonces de vente de véhicules d'occasion qui se vendent vite et bien.

RÈGLES :
- Titre accrocheur et précis (max 80 chars)
- Description 150–250 mots, structurée (présentation / équipements / état / achat chez nous)
- Français belge, ton professionnel mais accessible
- Pas de mensonges, ne cache jamais un défaut connu
- Mets en avant garantie, entretien documenté, Car-Pass

FORMAT DE SORTIE — JSON strict sans markdown :
{
  "titre": "...",
  "description": "...",
  "points_forts": ["...", "...", "..."],
  "tags": ["...", "..."]
}`;
}

export function buildListingUserMessage(input: ListingDraftInput): string {
  const fields = [
    input.make && input.model ? `- Marque / Modèle : ${input.make} ${input.model}` : '',
    input.year   ? `- Année : ${input.year}` : '',
    input.km     ? `- Kilométrage : ${input.km.toLocaleString('fr-BE')} km` : '',
    input.fuel   ? `- Carburant : ${input.fuel}` : '',
    input.gearbox? `- Boîte : ${input.gearbox}` : '',
    input.color  ? `- Couleur : ${input.color}` : '',
    input.power  ? `- Puissance : ${input.power}` : '',
    input.equipment ? `- Équipements : ${input.equipment}` : '',
    input.condition ? `- État général : ${input.condition}` : '',
    input.maintenanceHistory ? `- Entretien : ${input.maintenanceHistory}` : '',
    input.warranty ? `- Garantie : ${input.warranty}` : '',
    input.targetSellPrice ? `- Prix de vente visé : ${input.targetSellPrice.toLocaleString('fr-BE')} €` : '',
  ].filter(Boolean).join('\n');
  return `Rédige l'annonce pour ce véhicule :\n\n${fields}`;
}
```

---

### `lib/agents/controller/system-prompt.ts`
```typescript
import { MARGES, GP_CARS_PARAMS, EXCLUSIONS_ABSOLUES } from '@/lib/carmelo/config';
import type { VehicleSummary, ControllerFlag } from '../shared-types';

export function buildControllerSystemPrompt(): string {
  return `Tu es l'Agent Contrôleur de GP-CARS.
Vérifie les données soumises par les agents Achats et Marketing.
Détecte incohérences, erreurs et violations des règles GP-CARS.

Vérifie :
1. Marges : standard ≥ ${MARGES.standard.cible} €, premium ≥ ${MARGES.premium.cible} €
2. Plafond achat ≤ ${GP_CARS_PARAMS.plafond_achat_vehicule} €
3. Cohérence km / année
4. Exclusions absolues : ${EXCLUSIONS_ABSOLUES.join(', ')}
5. Annonce : titre ≥ 20 chars, description non vide
6. Confiance < ${GP_CARS_PARAMS.seuil_confiance_autonome}% → VALIDATION HUMAINE REQUISE

FORMAT JSON strict :
{
  "valide": true|false,
  "requires_human_validation": true|false,
  "flags": [{ "code": "...", "severity": "bloquant|avertissement|info", "message": "..." }],
  "summary": "1 phrase"
}`;
}

export function runHardRules(vehicle: VehicleSummary): ControllerFlag[] {
  const flags: ControllerFlag[] = [];

  if (vehicle.realBuyPrice != null && vehicle.realBuyPrice > GP_CARS_PARAMS.plafond_achat_vehicule)
    flags.push({ code: 'PLAFOND_ACHAT_DEPASSE', severity: 'bloquant',
      message: `Prix d'achat réel (${vehicle.realBuyPrice.toLocaleString('fr-BE')} €) dépasse le plafond (${GP_CARS_PARAMS.plafond_achat_vehicule.toLocaleString('fr-BE')} €).` });

  if (vehicle.maxBuyPrice != null && vehicle.askingPrice != null && vehicle.askingPrice > vehicle.maxBuyPrice)
    flags.push({ code: 'PRIX_ACHAT_DEPASSE_MAX', severity: 'bloquant',
      message: `Prix demandé (${vehicle.askingPrice.toLocaleString('fr-BE')} €) dépasse le max conseillé (${vehicle.maxBuyPrice.toLocaleString('fr-BE')} €).` });

  if (vehicle.realMargin != null) {
    const tier = (vehicle.realSellPrice || 0) >= 20000 ? 'premium' : 'standard';
    if (vehicle.realMargin < MARGES[tier].orange_min)
      flags.push({ code: 'MARGE_INSUFFISANTE', severity: 'bloquant',
        message: `Marge réelle (${vehicle.realMargin.toLocaleString('fr-BE')} €) sous le seuil ${tier} (${MARGES[tier].orange_min.toLocaleString('fr-BE')} €).` });
  }

  if (vehicle.km != null && vehicle.year != null) {
    const age = new Date().getFullYear() - vehicle.year;
    const avgKm = age > 0 ? vehicle.km / age : vehicle.km;
    if (avgKm > 50000)
      flags.push({ code: 'KM_SUSPECT', severity: 'avertissement',
        message: `Kilométrage suspect : ${Math.round(avgKm).toLocaleString('fr-BE')} km/an (seuil 50 000).` });
  }

  return flags;
}
```

---

### `app/db.ts` — SECTION VEHICLE (source de vérité)
```typescript
// Les imports incluent : drizzle-orm, postgres, bcrypt-ts, shared-types
// Les tables User, CarmeloAnalysis, CarmeloOpportunity existent aussi (code non répété ici)

const vehicle = pgTable('Vehicle', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 64 }),
  make: varchar('make', { length: 48 }), model: varchar('model', { length: 64 }),
  year: integer('year'), km: integer('km'),
  fuel: varchar('fuel', { length: 32 }), gearbox: varchar('gearbox', { length: 32 }),
  color: varchar('color', { length: 32 }), power: varchar('power', { length: 32 }),
  vin: varchar('vin', { length: 20 }), listingUrl: text('listing_url'),
  status: varchar('status', { length: 16 }).$type<VehicleStatus>(),
  // Agent Achats
  askingPrice: integer('asking_price'), marketPrice: integer('market_price'),
  maxBuyPrice: integer('max_buy_price'), estimatedMargin: integer('estimated_margin'),
  rotationScore: integer('rotation_score'), confidence: integer('confidence'),
  decision: varchar('decision', { length: 16 }).$type<AgentDecision>(),
  analysisReport: text('analysis_report'), analysisId: integer('analysis_id'),
  // Achat réel
  realBuyPrice: integer('real_buy_price'), boughtAt: timestamp('bought_at'),
  // Agent Marketing
  listingTitle: text('listing_title'), listingDescription: text('listing_description'),
  listingPoints: json('listing_points').$type<string[]>(),
  listingTags: json('listing_tags').$type<string[]>(),
  publishedAt: timestamp('published_at'), listingExpiresAt: timestamp('listing_expires_at'),
  publishedPlatforms: json('published_platforms').$type<string[]>(),
  // Vente réelle
  realSellPrice: integer('real_sell_price'), soldAt: timestamp('sold_at'),
  soldInDays: integer('sold_in_days'), realMargin: integer('real_margin'),
  // Agent Contrôleur
  controllerValidated: boolean('controller_validated'),
  requiresHumanValidation: boolean('requires_human_validation'),
  controllerFlags: json('controller_flags').$type<ControllerFlag[]>(),
  controllerNotes: text('controller_notes'),
  createdAt: timestamp('created_at'), updatedAt: timestamp('updated_at'),
});

export async function createVehicle(email: string, data: NewVehicleData): Promise<VehicleRecord[]> {
  await ensureVehicleTableExists();
  return await db.insert(vehicle).values({
    email, status: 'analyse',
    ...data,
    decision: data.decision ?? 'INCONNU',
    controllerValidated: false,
    requiresHumanValidation: (data.confidence ?? 100) < 85,
  }).returning();
}

export async function recordSale(id: number, email: string, realSellPrice: number, soldAt: Date) {
  const row = await getVehicle(id, email);
  if (!row) return;
  const start = row.boughtAt || row.publishedAt || row.createdAt;
  const soldInDays = start
    ? Math.max(0, Math.round((soldAt.getTime() - new Date(start).getTime()) / 86_400_000))
    : null;
  const realMargin = row.realBuyPrice != null
    ? realSellPrice - row.realBuyPrice - 1005  // ← plancher frais approx hardcodé
    : null;
  return await db.update(vehicle)
    .set({ status: 'vendu', realSellPrice, soldAt, soldInDays, realMargin, updatedAt: new Date() })
    .where(and(eq(vehicle.id, id), eq(vehicle.email, email)));
}

// ensureVehicleTableExists : boolean en module-scope (non thread-safe sur Vercel multi-instances)
let vehicleTableReady = false;
async function ensureVehicleTableExists() {
  if (vehicleTableReady) return;
  await client`CREATE TABLE IF NOT EXISTS "Vehicle" ( ... );`;
  vehicleTableReady = true;
}
```

---

### `app/api/agents/vehicle/route.ts`
```typescript
// GET  /api/agents/vehicle?summary=true  → liste ou summaries
// POST /api/agents/vehicle               → créer véhicule | set_status | record_sale

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Corps de requête manquant.' }, { status: 400 });

  const action = body.action as string | undefined;

  if (action === 'set_status') {
    const id = toInt(body.id);
    const status = body.status as string;
    if (!id || !VALID_STATUSES.includes(status as VehicleStatus))
      return NextResponse.json({ error: 'id ou status invalide.' }, { status: 400 });
    const extra: Record<string, unknown> = {};
    if (status === 'achete' && body.realBuyPrice) extra.realBuyPrice = toInt(body.realBuyPrice);
    if (status === 'achete' && body.boughtAt)     extra.boughtAt = new Date(body.boughtAt);
    if (status === 'publie' && body.platforms)    extra.publishedPlatforms = body.platforms;
    if (status === 'publie') extra.publishedAt = new Date();
    await updateVehicleStatus(id, session.user.email, status as VehicleStatus, extra as any);
    return NextResponse.json({ ok: true });
  }

  if (action === 'record_sale') {
    const id = toInt(body.id); const price = toInt(body.realSellPrice);
    const soldAt = body.soldAt ? new Date(body.soldAt) : new Date();
    if (!id || !price) return NextResponse.json({ error: 'invalide.' }, { status: 400 });
    await recordSale(id, session.user.email, price, soldAt);
    return NextResponse.json({ ok: true });
  }

  // Create
  const rows = await createVehicle(session.user.email, { /* ...body fields */ });
  return NextResponse.json({ vehicle: rows[0] });
}
```

---

### `app/api/agents/marketing/route.ts`
```typescript
export async function POST(req: NextRequest) {
  const session = await auth();
  // ...auth + apiKey checks...

  const body = await req.json().catch(() => null);
  const vehicleId = Number(body?.vehicleId);
  const row = await getVehicle(vehicleId, email);
  if (!row) return NextResponse.json({ error: 'Véhicule introuvable.' }, { status: 404 });

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-opus-4-8', max_tokens: 1024,
    system: buildMarketingSystemPrompt(),
    messages: [{ role: 'user', content: buildListingUserMessage({ ...row, equipment: body?.equipment, condition: body?.condition, maintenanceHistory: body?.maintenanceHistory, warranty: body?.warranty }) }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  let draft: any = {};
  try { draft = JSON.parse(text); }
  catch { return NextResponse.json({ error: 'Réponse inattendue.', raw: text }, { status: 500 }); }

  await saveMarketingDraft(vehicleId, email, {
    title: draft.titre || '', description: draft.description || '',
    points: draft.points_forts || [], tags: draft.tags || [],
  });
  return NextResponse.json({ draft });
}
```

---

### `app/api/agents/controller/route.ts`
```typescript
export async function POST(req: NextRequest) {
  // ...auth + apiKey...
  const vehicleId = Number(body?.vehicleId);
  const row = await getVehicle(vehicleId, email);

  const summary: VehicleSummary = { /* ...map row fields... */ };

  // 1. Hard rules (sync, no LLM)
  const hardFlags = runHardRules(summary);
  const hasBlocker = hardFlags.some((f) => f.severity === 'bloquant');

  // 2. LLM for nuanced checks (only if no blocker)
  let llmFlags = [], llmSummary = '';
  let requiresHuman = (row.confidence ?? 100) < 85;
  if (!hasBlocker) {
    const response = await client.messages.create({
      model: 'claude-opus-4-8', max_tokens: 512,
      system: buildControllerSystemPrompt(),
      messages: [{ role: 'user', content: JSON.stringify({ vehicule: ..., km: ..., margins: ... }) }],
    });
    const parsed = JSON.parse(response.content[0].text);
    llmFlags = parsed.flags || [];
    requiresHuman = requiresHuman || parsed.requires_human_validation;
  }

  const allFlags = [...hardFlags, ...llmFlags];
  const validated = !allFlags.some((f) => f.severity === 'bloquant');

  await saveControllerResult(vehicleId, email, { validated, requiresHuman, flags: allFlags as any, notes: llmSummary });
  return NextResponse.json({ validated, requiresHuman, flags: allFlags });
}
```

---

### `app/api/carmelo/analyze/route.ts` — section sauvegarde (fin du stream)
```typescript
// Après réception complète du stream :
if (full.trim().length > 0) {
  try {
    const analysisRows = await saveAnalysis(email, vehicule, full, url || null);
    const analysisId = (analysisRows as any)?.[0]?.id ?? null;  // ← cast non sûr

    const parsed = parseReport(full);
    await createVehicle(email, {
      make: parsed.make,
      listingUrl: url || null,
      askingPrice: null,          // ← jamais renseigné ici
      marketPrice: parsed.marketPrice,
      maxBuyPrice: parsed.recommendedMaxBuy,
      estimatedMargin: parsed.estimatedMargin,
      rotationScore: parsed.rotationScore,
      confidence: parsed.confidence,
      decision: parsed.decision,
      analysisReport: full,
      analysisId,
    });
  } catch (err) {
    console.error('Carmelo: échec sauvegarde', err);
  }
}
```

---

### `app/api/agents/analytics/route.ts`
```typescript
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const summaries = await getVehicleSummaries(session.user.email);
  return NextResponse.json({
    makeStats:   computeMakeStats(summaries),
    stockHealth: computeStockHealth(summaries),
    kpis:        computePerformanceKPIs(summaries),
  });
}
```

---

### `app/gp/stock/page.tsx` *(structure)*
```typescript
// Page SSR — affiche tous les véhicules groupés par statut (prospect→vendu)
// KPIs: nb en stock, nb vendus, valeur stock, marge totale vendue
// Chaque fiche: make/model/year/km, décision dot (vert/orange/rouge),
//   badge "⚠️ Validation requise" si requiresHumanValidation,
//   champs clés (prix demandé, achat max, marge estimée, confiance, rotation),
//   flags contrôleur (🔴 bloquant, 🟡 avertissement)
// Actions: acheté → en_stock → rédiger annonce → publié → vente
// StockActions: composant client avec fetch vers /api/agents/vehicle et /api/agents/marketing
```

---

### `app/gp/dashboard/page.tsx` *(structure)*
```typescript
// Page SSR analytics
// KPIs: vendus ce mois, vendus cette semaine, marge moyenne 30j, rotation moyenne 30j
// État du stock: inStock, published, valeur stock, avgDaysInStock
// Véhicules lents: publiés > 60 jours sans vente
// Achats recommandés: objectif stock, stock actuel, à racheter cette semaine, best/worst marque
// Tableau par marque: count, sold, conversion%, avgMargin, avgDays
```

---

### `app/actions.ts`
```typescript
'use server';
// saveApiKey — stocke la clé API Anthropic en cookie httpOnly
// updateVehicleOutcome — met à jour CarmeloAnalysis (legacy)
// setOpportunityStatus — met à jour CarmeloOpportunity (legacy)
// Note : aucune action server-side pour Vehicle (tout passe par les routes API)
```

---

### `app/auth.config.ts`
```typescript
callbacks: {
  authorized({ auth, request: { nextUrl } }) {
    const isLoggedIn = !!auth?.user;
    const isOnDashboard =
      nextUrl.pathname.startsWith('/protected') ||
      nextUrl.pathname.startsWith('/carmelo') ||
      nextUrl.pathname.startsWith('/settings') ||
      nextUrl.pathname.startsWith('/gp');         // ← nouvelles routes protégées
    if (isOnDashboard) { if (isLoggedIn) return true; return false; }
    else if (isLoggedIn) { return Response.redirect(new URL('/protected', nextUrl)); }
    return true;
  },
}
```

---

### `middleware.ts`
```typescript
// matcher: '/((?!api|_next/static|_next/image|.*\\.png$).*)'
// Les routes /api/agents/* ne passent PAS par le middleware auth
// → chaque route API gère son propre auth() call
```

---

## PROBLÈMES CONNUS QUE JE SOUPÇONNE (à confirmer/infirmer)

1. **Thread-safety** : `let vehicleTableReady = false` — module-scope boolean sur Vercel multi-instances → race condition possible si deux requêtes arrivent simultanément sur une nouvelle instance.

2. **Données dupliquées** : chaque analyse Carmelo crée un `Vehicle` ET un `CarmeloAnalysis`. Les deux tables existent en parallèle avec des données qui se chevauchent. Est-ce une dette ou un problème réel ?

3. **Cast non sûr** : `(analysisRows as any)?.[0]?.id` dans analyze/route.ts. `saveAnalysis` retourne `void` (INSERT sans RETURNING). L'analysisId sera toujours `null`.

4. **Frais hardcodés** : `realMargin = realSellPrice - realBuyPrice - 1005` dans `recordSale`. Ce chiffre (plancher frais) devrait venir de `PLANCHER_FRAIS` dans config.ts.

5. **`slowVehicles` dans analytics.ts** : cast `(v as any).publishedAt` — le type `VehicleSummary` n'inclut pas `publishedAt`. Les véhicules lents seront toujours vides.

6. **`bestMake` / `worstMake`** : le même tableau `makeStats` est muté deux fois par `.sort()` sans copie → le deuxième tri écrase le premier, les deux variables peuvent pointer sur la même marque.

7. **`saveAnalysis` ne retourne pas l'id** : pas de `.returning()` dans l'INSERT.

8. **Pas de rate limiting** sur `/api/agents/marketing` et `/api/agents/controller` → appels LLM non limités.

9. **`boughtAt` non transmis** depuis le client quand on marque "acheté" sans saisir la date.

10. **Pas de lien Vehicle → CarmeloOpportunity** : une opportunité détectée n'est jamais reliée au Vehicle créé lors de l'analyse.

---

## QUESTIONS SPÉCIFIQUES

**Architecture multi-agents :**
1. Les trois agents (Achats, Marketing, Contrôleur) partagent la table `Vehicle` mais aucun mécanisme ne garantit l'ordre d'exécution ni n'empêche deux agents d'écrire simultanément sur le même enregistrement. Quels patterns recommandes-tu (optimistic locking, event sourcing léger, queue) pour un contexte Next.js / Vercel ?

2. Le Contrôleur est actuellement déclenché manuellement depuis l'interface. Devrait-il être déclenché automatiquement après chaque analyse Carmelo ? Comment architecturer ça proprement sans créer un couplage fort ?

3. L'Agent Marketing reçoit `row.marketPrice` comme `targetSellPrice` — mais `marketPrice` est la valeur estimée par Carmelo, pas le vrai prix de revente cible. Quel champ devrait-il utiliser ?

**Performance :**
4. `getVehicles` charge 200 enregistrements avec tous les champs (dont `analysisReport` TEXT potentiellement très long). Quel est l'impact mémoire en production ? Faut-il paginer ou séparer les champs lourds ?

5. Le dashboard (`/gp/dashboard`) recharge toutes les données à chaque requête SSR. Pour un garage qui a 500 véhicules historiques, est-ce tenable sans cache ?

**Sécurité :**
6. Les routes `/api/agents/*` vérifient `auth()` mais ne vérifient pas que le `vehicleId` appartient à l'utilisateur dans tous les cas (le `getVehicle(id, email)` protège, mais `createVehicle` n'a pas de quota). Un utilisateur peut-il créer des milliers de véhicules et saturer la DB ?

7. Le champ `analysisReport` (texte complet de Carmelo) est stocké dans `Vehicle`. Si un acteur malveillant injecte un prompt dans le contenu d'une annonce récupérée via `fetchListing`, ce texte se retrouve en DB et est réinjecté dans le contexte des futurs appels IA via `buildMemoryBlock`. Comment mitiger ce risque d'injection indirecte ?

**Métier :**
8. Quand un véhicule passe de `publie` à `vendu`, l'annonce sur AutoScout24 / Gocar n'est pas supprimée automatiquement (pas d'intégration). Quel workflow propose-tu pour éviter qu'une annonce reste en ligne après la vente ?

9. Le système ne gère pas les **négociations** : Carmelo propose un prix max, mais il n'y a nulle part un champ "prix proposé au vendeur" ni un historique des échanges. Est-ce un manque critique à ce stade ?

10. Qu'est-ce qui manque encore pour que ce système soit utilisable au quotidien par deux personnes non techniques sur mobile ?

---

**Sois exhaustif. Pour chaque problème confirmé, fournis le correctif TypeScript complet.**
