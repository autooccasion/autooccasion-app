# PROMPT DE REVUE — CARMELO / GP-CARS

Tu es un architecte logiciel senior spécialisé en Next.js 14, TypeScript strict, Drizzle ORM, et en systèmes IA intégrés en production.

Je vais te soumettre la base de code complète de **Carmelo**, l'agent d'achat IA de GP-CARS (garage automobile à Soumagne, Belgique). 

## Ce que je veux que tu fasses

1. **Audit de correction** — bugs, erreurs silencieuses, cas aux limites non gérés, comportements dangereux.
2. **Audit sécurité** — injections, SSRF, RGPD, fuites de données, surface d'attaque.
3. **Audit architecture** — couplages fragiles, anti-patterns, dette technique, ce qui cassera en production.
4. **Audit performance** — requêtes inutiles, N+1, hot paths non cachés.
5. **Opportunités d'amélioration métier** — qu'est-ce qui manque encore pour que cet agent soit vraiment utile au quotidien d'un garage ?

Pour chaque problème trouvé : **fichier + numéro de ligne approximatif + sévérité (🔴 critique / 🟠 élevé / 🟡 moyen / 🔵 faible) + correctif précis**.

---

## CONTEXTE MÉTIER

GP-CARS est un garage de véhicules d'occasion tenu par Francisco et Michael (Soumagne, Belgique).
Carmelo est leur agent IA de Directeur des Achats. Il doit :
- Analyser une annonce de véhicule (lien ou texte) et produire un rapport structuré : décision verte/orange/rouge, prix de marché, prix d'achat maximum, marge estimée, score de rotation, niveau de confiance.
- Mémoriser chaque analyse (DB Postgres) avec les vrais résultats (acheté / vendu / jours en stock) pour calibrer ses prochaines analyses.
- Étudier les prix de marché et positionner les véhicules comme « bonne affaire » (réplication du label AutoScout24).
- Rédiger des messages de prise de contact vendeur (toujours validés par un humain avant envoi).
- Alimenter un fil d'opportunités quotidiennes.

Stack : Next.js 14 App Router · TypeScript strict · Drizzle ORM · Postgres · NextAuth v5 (beta) · Anthropic SDK (claude-opus-4-8) · Tailwind · Vitest.

---

## CODE COMPLET

### `lib/carmelo/config.ts`
```typescript
// Carmelo — GP-CARS purchasing agent configuration

export const COST_REFERENCE = {
  ct_carpass: 105,
  preparation_standard: 100,
  publicite: 200,
  entretien: { min: 200, max: 300 },
  transport_belgique: { min: 0, max: 200 },
  transport_import: { min: 250, max: 400 },
  pneus_4: { min: 300, max: 600 },
  freins: { min: 200, max: 400 },
  garantie: { min: 300, max: 600 },
  carrosserie: 'devis_reel',
} as const;

export const PLANCHER_FRAIS = 405;

export const COST_CHECKLIST = [
  'entretien_recent_documente',
  'pneus_50_pct_min',
  'freins_corrects',
  'carrosserie_sans_defaut',
  'garantie_constructeur_restante',
  'ct_valide_belgique',
  'distance_transport_km',
] as const;

export const MARGES = {
  standard: { cible: 3000, orange_min: 2500, rouge_seuil: 2500 },
  premium:  { cible: 4000, orange_min: 3500, rouge_seuil: 3500 },
} as const;

export const ROTATION = {
  tres_liquide: { min: 9, max: 10, delai_jours: 30 },
  liquide:      { min: 7, max: 8,  delai_jours: 60 },
  moyen:        { min: 5, max: 6,  delai_jours: 90 },
  lent:         { min: 0, max: 4,  delai_jours: 120 },
} as const;

export const GP_CARS_PARAMS = {
  plafond_achat_vehicule: 25000,
  budget_max_jour: 40000,
  seuil_confiance_autonome: 85,
  coussin_negociation_client_pct: 3,
};

export const MARQUES_PREFEREES = [
  'Kia', 'Hyundai', 'Toyota', 'Volkswagen', 'Audi', 'BMW', 'Mercedes',
] as const;

export const EXCLUSIONS_ABSOLUES = [
  'Moteurs PSA PureTech',
  'Historique douteux',
  'Kilométrage incohérent',
  'Entretien absent ou non documenté',
  'Import douteux avec historique incomplet',
  'Véhicule accidenté lourdement',
  'Couleur difficile (rouge, beige, atypique)',
  'Modèle à risque mécanique connu élevé',
  'Marge cible non atteignable',
] as const;
```

### `lib/carmelo/decision.ts`
```typescript
export type Decision = 'VERT' | 'ORANGE' | 'ROUGE' | 'INCONNU';

export function extractDecision(analyse: string): Decision {
  const text = (analyse || '').toUpperCase();
  if (text.includes('ROUGE')) return 'ROUGE';
  if (text.includes('ORANGE')) return 'ORANGE';
  if (text.includes('VERT')) return 'VERT';
  return 'INCONNU';
}
```

### `lib/carmelo/parse.ts`
```typescript
import { extractDecision, type Decision } from './decision';

export type ParsedAnalysis = {
  vehiculeResume: string | null;
  make: string | null;
  decision: Decision;
  marketPrice: number | null;
  recommendedMaxBuy: number | null;
  estimatedMargin: number | null;
  rotationScore: number | null;
  confidence: number | null;
};

const BRANDS = [
  'Kia', 'Hyundai', 'Toyota', 'Volkswagen', 'Audi', 'BMW', 'Mercedes',
  'Renault', 'Peugeot', 'Citroën', 'Opel', 'Ford', 'Skoda', 'Seat',
  'Volvo', 'Nissan', 'Mazda', 'Honda', 'Fiat', 'Dacia', 'Mini',
  'Suzuki', 'Mitsubishi', 'Tesla', 'Cupra', 'Land Rover', 'Jaguar',
  'Porsche', 'Alfa Romeo', 'Lexus',
];

function parseNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

function matchLine(report: string, pattern: RegExp): string | null {
  const m = report.match(pattern);
  return m ? m[1].trim() : null;
}

function detectMake(resume: string | null): string | null {
  if (!resume) return null;
  const lower = resume.toLowerCase();
  for (const brand of BRANDS) {
    if (lower.includes(brand.toLowerCase())) return brand;
  }
  return null;
}

export function parseReport(report: string): ParsedAnalysis {
  const text = report || '';
  const rawResume = matchLine(text, /V[ée]hicule\s*:\s*(.+)/i);
  const vehiculeResume = rawResume
    ? rawResume.replace(/^\[|\]$/g, '').trim() || null
    : null;
  return {
    vehiculeResume,
    make: detectMake(vehiculeResume),
    decision: extractDecision(text),
    marketPrice:        parseNumber(matchLine(text, /Prix march[ée]\s+r[ée]el\s*:\s*([\d.\s,]+)\s*€/i)),
    recommendedMaxBuy:  parseNumber(matchLine(text, /PRIX MAXIMUM [ÀA] REMETTRE\s*:\s*([\d.\s,]+)\s*€/i)),
    estimatedMargin:    parseNumber(matchLine(text, /Marge estim[ée]e\s*:\s*([\d.\s,]+)\s*€/i)),
    rotationScore:      parseNumber(matchLine(text, /Score Rotation\s*:\s*([\d]+)\s*\/\s*10/i)),
    confidence:         parseNumber(matchLine(text, /Niveau de confiance\s*:\s*([\d]+)\s*%/i)),
  };
}
```

### `lib/carmelo/memory.ts`
```typescript
export type LearningRecord = {
  vehiculeResume?: string | null;
  make?: string | null;
  decision?: string | null;
  recommendedMaxBuy?: number | null;
  status?: string | null;
  realBuyPrice?: number | null;
  realSellPrice?: number | null;
  soldInDays?: number | null;
  createdAt?: Date | string | null;
};

function euro(n: number | null | undefined): string {
  if (n == null) return '?';
  return `${n.toLocaleString('fr-BE')} €`;
}

function scoreRecord(r: LearningRecord, haystack: string): number {
  let score = 0;
  if (r.status === 'vendu' && r.realSellPrice != null) score += 4;
  if (r.status === 'achete') score += 2;
  if (r.make && haystack.includes(r.make.toLowerCase())) score += 3;
  return score;
}

export function selectRelevant(
  records: LearningRecord[],
  haystack: string,
  max = 8,
): LearningRecord[] {
  const lower = (haystack || '').toLowerCase();
  const scored = records
    .map((r) => ({ r, s: scoreRecord(r, lower) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  if (scored.length === 0) {
    return records
      .filter((r) => r.status === 'vendu' && r.realSellPrice != null)
      .slice(0, max);
  }
  return scored.slice(0, max).map((x) => x.r);
}

function formatRecord(r: LearningRecord): string {
  const label = r.vehiculeResume || r.make || 'Véhicule';
  if (r.status === 'vendu' && r.realSellPrice != null) {
    const days = r.soldInDays != null ? `${r.soldInDays} j` : 'délai inconnu';
    return `- VENDU · ${label} · acheté ${euro(r.realBuyPrice)} → vendu ${euro(r.realSellPrice)} en ${days}`;
  }
  if (r.status === 'achete') {
    return `- ACHETÉ · ${label} · prix d'achat ${euro(r.realBuyPrice)} (encore en stock)`;
  }
  return `- ANALYSÉ · ${label} · conseil achat max ${euro(r.recommendedMaxBuy)} · décision ${r.decision || '?'}`;
}

export function buildMemoryBlock(records: LearningRecord[]): string {
  if (!records || records.length === 0) return '';
  const lines = records.map(formatRecord).join('\n');
  return [
    '--- MÉMOIRE GP-CARS (achats/ventes réels — pour calibrer, ne jamais inventer) ---',
    lines,
    'Utilise ces cas réels pour ajuster ton prix et ton score de rotation. Si un véhicule similaire a mis longtemps à se vendre ou a généré une faible marge, sois plus prudent.',
  ].join('\n');
}
```

### `lib/carmelo/market.ts`
```typescript
import { PLANCHER_FRAIS, MARGES, GP_CARS_PARAMS } from './config';

export const SELL_POSITION_FACTOR = 0.96;
export const SCREENING_PROVISION = 600;

export type MarketStats = {
  sample: number; median: number; p25: number; p75: number; min: number; max: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx); const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

export function computeStats(prices: number[], minSample = 3): MarketStats | null {
  const clean = prices.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (clean.length < minSample) return null;
  return {
    sample: clean.length,
    median: percentile(clean, 0.5),
    p25: percentile(clean, 0.25),
    p75: percentile(clean, 0.75),
    min: clean[0],
    max: clean[clean.length - 1],
  };
}

export type Positioning =
  | 'tres_bonne_affaire' | 'bonne_affaire' | 'correct' | 'eleve' | 'tres_eleve';

export const POSITIONING_LABELS: Record<Positioning, string> = {
  tres_bonne_affaire: 'Très bonne affaire',
  bonne_affaire: 'Bonne affaire',
  correct: 'Prix correct',
  eleve: 'Prix élevé',
  tres_eleve: 'Prix très élevé',
};

export function positionPrice(price: number, stats: MarketStats): Positioning {
  const ratio = price / stats.median;
  if (ratio <= 0.9)  return 'tres_bonne_affaire';
  if (ratio <= 0.97) return 'bonne_affaire';
  if (ratio <= 1.03) return 'correct';
  if (ratio <= 1.1)  return 'eleve';
  return 'tres_eleve';
}

export type OpportunityZone = 'vert' | 'orange' | 'rouge';

export type Opportunity = {
  stats: MarketStats;
  targetSell: number;
  targetPositioning: Positioning;
  tier: 'standard' | 'premium';
  marginTarget: number;
  costs: number;
  cushion: number;
  maxBuy: number;
  askingPrice: number;
  askingPositioning: Positioning;
  marginAtAsk: number;
  zone: OpportunityZone;
  isGoodDeal: boolean;
  exceedsCeiling: boolean;
};

export function evaluateOpportunity(askingPrice: number, stats: MarketStats): Opportunity {
  const targetSell = Math.round(stats.median * SELL_POSITION_FACTOR);
  const tier: 'standard' | 'premium' = targetSell >= 20000 ? 'premium' : 'standard';
  const marginTarget = MARGES[tier].cible;
  const cushion = Math.round((targetSell * GP_CARS_PARAMS.coussin_negociation_client_pct) / 100);
  const costs = PLANCHER_FRAIS + SCREENING_PROVISION;
  const maxBuy = targetSell - marginTarget - costs - cushion;
  const marginAtAsk = targetSell - askingPrice - costs - cushion;
  let zone: OpportunityZone;
  if (marginAtAsk >= marginTarget) zone = 'vert';
  else if (marginAtAsk >= MARGES[tier].orange_min) zone = 'orange';
  else zone = 'rouge';
  const exceedsCeiling = askingPrice > GP_CARS_PARAMS.plafond_achat_vehicule;
  return {
    stats, targetSell,
    targetPositioning: positionPrice(targetSell, stats),
    tier, marginTarget, costs, cushion, maxBuy,
    askingPrice,
    askingPositioning: positionPrice(askingPrice, stats),
    marginAtAsk, zone,
    isGoodDeal: zone !== 'rouge' && askingPrice <= maxBuy && !exceedsCeiling,
    exceedsCeiling,
  };
}
```

### `lib/carmelo/fetch-listing.ts`
```typescript
const ALLOWED_HOST_SUFFIXES = [
  'autoscout24.be','autoscout24.com','autoscout24.fr','autoscout24.nl','autoscout24.de',
  'gocar.be', '2dehands.be','2ememain.be', 'automobile.be','autotrader.be', 'mobile.de',
];

export function isAllowedListingUrl(rawUrl: string): boolean {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) return false;
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&euro;/g, '€')
    .replace(/&#(\d+);/g, (_, d) => { const c=parseInt(d,10); return Number.isFinite(c)?String.fromCharCode(c):' '; })
    .replace(/\s+/g, ' ').trim();
}

export type ListingFetchResult = { ok: boolean; text?: string; error?: string; };

export async function fetchListing(rawUrl: string): Promise<ListingFetchResult> {
  if (!isAllowedListingUrl(rawUrl)) {
    return { ok: false, error: 'Lien non pris en charge. Plateformes acceptées : AutoScout24, Gocar, 2dehands/2ememain, mobile.de.' };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(rawUrl, {
      redirect: 'follow', signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'fr-BE,fr;q=0.9,nl;q=0.8',
        Accept: 'text/html,application/xhtml+xml',
      },
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) return { ok: false, error: `La page a renvoyé une erreur (HTTP ${res.status}).` };
    const html = await res.text();
    const text = htmlToText(html).slice(0, 6000);
    if (text.length < 200) return { ok: false, error: "Contenu illisible (page protégée ou chargée en JavaScript). Collez le texte de l'annonce." };
    return { ok: true, text };
  } catch {
    return { ok: false, error: "Impossible de lire le lien. Collez le texte de l'annonce." };
  }
}
```

### `lib/carmelo/contact-prompt.ts`
```typescript
export type ContactDraftInput = {
  vehicule: string;
  askingPrice?: number | null;
  targetPrice?: number | null;
  langue?: 'fr' | 'nl';
};

function euro(n: number | null | undefined): string {
  return n == null ? '?' : `${n.toLocaleString('fr-BE')} €`;
}

export function buildContactDraftPrompt(input: ContactDraftInput): string {
  const langue = input.langue === 'nl' ? 'néerlandais' : 'français';
  return `Tu es Carmelo, acheteur professionnel pour GP-CARS (garage à Soumagne, Belgique).
Rédige un PREMIER message de prise de contact à envoyer au vendeur d'un véhicule d'occasion.

Contexte (interne — ne pas tout divulguer au vendeur) :
- Véhicule : ${input.vehicule}
- Prix demandé : ${euro(input.askingPrice)}
- Prix maximum que GP-CARS souhaite payer : ${euro(input.targetPrice)}

Objectif du message :
- Créer un premier contact cordial et professionnel, au nom de GP-CARS.
- Montrer un intérêt sincère et sérieux pour le véhicule.
- Vérifier naturellement, sans interrogatoire :
  1. Le véhicule est-il toujours disponible ?
  2. Dispose-t-il de tout son historique d'entretien (carnet / factures) ?
  3. A-t-il déjà été accidenté ?
  4. Y a-t-il encore un financement / leasing en cours ?
- Proposer un rendez-vous / une visite.
- Sonder délicatement s'il existe une marge de négociation, SANS annoncer de chiffre.

Règles :
- Écris en ${langue}, ton courtois, direct, jamais agressif.
- Court mais complet (5 à 9 phrases), fluide et naturel, prêt à envoyer.
- Ne mentionne JAMAIS notre prix maximum ni notre marge.
- Signe « GP-CARS ».

Réponds uniquement avec le texte du message, sans commentaire.`;
}
```

### `lib/carmelo/digest.ts`
```typescript
export type DigestOpportunity = {
  vehicule?: string | null; url?: string | null;
  askingPrice?: number | null; targetSell?: number | null;
  maxBuy?: number | null; zone?: string | null;
};

function euro(n: number | null | undefined): string {
  return n == null ? '?' : `${n.toLocaleString('fr-BE')} €`;
}

export type Digest = { count: number; title: string; text: string; };

export function buildDigest(opportunities: DigestOpportunity[], date = new Date()): Digest {
  const count = opportunities.length;
  const jour = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  if (count === 0) return { count: 0, title: 'Aucune nouvelle opportunité', text: `Bilan du ${jour} : aucune bonne affaire détectée pour le moment.` };
  const lines = opportunities.map((o, i) => {
    const label = o.vehicule || 'Véhicule';
    const parts = [
      `${i + 1}. ${label}`,
      `   Prix demandé : ${euro(o.askingPrice)} · Achat max conseillé : ${euro(o.maxBuy)} · Revente cible : ${euro(o.targetSell)}`,
    ];
    if (o.url) parts.push(`   Annonce : ${o.url}`);
    return parts.join('\n');
  });
  const title = count === 1 ? '1 bonne affaire à regarder' : `${count} bonnes affaires à regarder`;
  const text = [`Bonjour, voici le bilan marché du ${jour}.`, `${title} :`, '', lines.join('\n\n'), '', 'Ouvrez Carmelo → Opportunités pour préparer la prise de contact.'].join('\n');
  return { count, title, text };
}
```

### `lib/carmelo/system-prompt.ts` *(extrait — 210 lignes)*
```typescript
import { COST_REFERENCE, MARGES, PLANCHER_FRAIS, MARQUES_PREFEREES, EXCLUSIONS_ABSOLUES, GP_CARS_PARAMS } from './config';

export function buildCarmeloSystemPrompt(): string {
  return `Tu es Carmelo, le Directeur des Achats et Analyste Marché de GP-CARS.
[...mission, interdictions absolues, profil véhicules, référentiel coûts, contraintes opérationnelles (plafond ${GP_CARS_PARAMS.plafond_achat_vehicule}€, budget/jour ${GP_CARS_PARAMS.budget_max_jour}€, seuil confiance ${GP_CARS_PARAMS.seuil_confiance_autonome}%), moteur de calcul top-down, politique de marge, score rotation, méthode de valorisation, sources d'information (annonce extraite + mémoire GP-CARS), format de sortie obligatoire, garde-fous...]
// Format de sortie imposé :
// Véhicule / Décision / Points forts / Points faibles / Risques / Cohérence km /
// Prix marché réel / Prix de vente réaliste / Frais détaillés / TOTAL FRAIS /
// Provision dégâts / Coussin négociation / Marge cible / PRIX MAXIMUM À REMETTRE /
// Marge estimée / Score Rotation /10 / Rotation probable / Niveau de confiance %
// + "⚠️ VALIDATION HUMAINE REQUISE" si confiance < 85%
`;
}
```

---

### `app/db.ts`
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import { pgTable, serial, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { eq, desc, and } from 'drizzle-orm';
import postgres from 'postgres';
import { genSaltSync, hashSync } from 'bcrypt-ts';
import { extractDecision } from '@/lib/carmelo/decision';
import { parseReport } from '@/lib/carmelo/parse';
export { extractDecision };

let client = postgres(`${process.env.POSTGRES_URL!}?sslmode=require`);
let db = drizzle(client);

// --- User table (auth) ---
export async function getUser(email: string) {
  const users = await ensureTableExists();
  return await db.select().from(users).where(eq(users.email, email));
}
export async function createUser(email: string, password: string) {
  const users = await ensureTableExists();
  let salt = genSaltSync(10);
  let hash = hashSync(password, salt);
  return await db.insert(users).values({ email, password: hash });
}
async function ensureTableExists() {
  const result = await client`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='User');`;
  if (!result[0].exists) await client`CREATE TABLE "User" (id SERIAL PRIMARY KEY, email VARCHAR(64), password VARCHAR(64));`;
  return pgTable('User', { id: serial('id').primaryKey(), email: varchar('email',{length:64}), password: varchar('password',{length:64}) });
}

// --- CarmeloAnalysis ---
export type VehicleStatus = 'analyse' | 'achete' | 'vendu' | 'refuse';

const carmeloAnalysis = pgTable('CarmeloAnalysis', {
  id: serial('id').primaryKey(),
  email: varchar('email',{length:64}), vehicule: text('vehicule'), url: text('url'),
  analyse: text('analyse'), decision: varchar('decision',{length:16}),
  vehiculeResume: text('vehicule_resume'), make: varchar('make',{length:48}),
  marketPrice: integer('market_price'), recommendedMaxBuy: integer('recommended_max_buy'),
  estimatedMargin: integer('estimated_margin'), rotationScore: integer('rotation_score'),
  confidence: integer('confidence'), status: varchar('status',{length:16}),
  realBuyPrice: integer('real_buy_price'), realSellPrice: integer('real_sell_price'),
  soldInDays: integer('sold_in_days'), boughtAt: timestamp('bought_at'),
  soldAt: timestamp('sold_at'), createdAt: timestamp('created_at'),
});
export type CarmeloAnalysisRecord = typeof carmeloAnalysis.$inferSelect;

export async function saveAnalysis(email: string, vehicule: string, analyse: string, url?: string | null) {
  await ensureAnalysisTableExists();
  const parsed = parseReport(analyse);
  return await db.insert(carmeloAnalysis).values({ email, vehicule, url: url||null, analyse, decision: parsed.decision, vehiculeResume: parsed.vehiculeResume, make: parsed.make, marketPrice: parsed.marketPrice, recommendedMaxBuy: parsed.recommendedMaxBuy, estimatedMargin: parsed.estimatedMargin, rotationScore: parsed.rotationScore, confidence: parsed.confidence, status: 'analyse' });
}
export async function getAnalyses(email: string, limit = 50) {
  await ensureAnalysisTableExists();
  return await db.select().from(carmeloAnalysis).where(eq(carmeloAnalysis.email, email)).orderBy(desc(carmeloAnalysis.createdAt)).limit(limit);
}
export type OutcomeUpdate = { status: VehicleStatus; realBuyPrice?: number|null; realSellPrice?: number|null; boughtAt?: Date|null; soldAt?: Date|null; };
export async function updateOutcome(id: number, email: string, outcome: OutcomeUpdate) {
  await ensureAnalysisTableExists();
  let soldInDays: number|null = null;
  if (outcome.status === 'vendu' && outcome.soldAt) {
    const rows = await db.select({createdAt: carmeloAnalysis.createdAt}).from(carmeloAnalysis).where(and(eq(carmeloAnalysis.id,id),eq(carmeloAnalysis.email,email))).limit(1);
    const start = outcome.boughtAt || rows[0]?.createdAt || null;
    if (start) { const ms = outcome.soldAt.getTime()-new Date(start).getTime(); soldInDays = Math.max(0,Math.round(ms/86_400_000)); }
  }
  return await db.update(carmeloAnalysis).set({ status: outcome.status, realBuyPrice: outcome.realBuyPrice??null, realSellPrice: outcome.realSellPrice??null, boughtAt: outcome.boughtAt??null, soldAt: outcome.soldAt??null, soldInDays }).where(and(eq(carmeloAnalysis.id,id),eq(carmeloAnalysis.email,email)));
}

let analysisTableReady = false;
async function ensureAnalysisTableExists() {
  if (analysisTableReady) return;
  await client`CREATE TABLE IF NOT EXISTS "CarmeloAnalysis" (id SERIAL PRIMARY KEY, email VARCHAR(64), vehicule TEXT, analyse TEXT, decision VARCHAR(16), created_at TIMESTAMP DEFAULT NOW());`;
  await client`ALTER TABLE "CarmeloAnalysis" ADD COLUMN IF NOT EXISTS url TEXT, ADD COLUMN IF NOT EXISTS vehicule_resume TEXT, ADD COLUMN IF NOT EXISTS make VARCHAR(48), ADD COLUMN IF NOT EXISTS market_price INTEGER, ADD COLUMN IF NOT EXISTS recommended_max_buy INTEGER, ADD COLUMN IF NOT EXISTS estimated_margin INTEGER, ADD COLUMN IF NOT EXISTS rotation_score INTEGER, ADD COLUMN IF NOT EXISTS confidence INTEGER, ADD COLUMN IF NOT EXISTS status VARCHAR(16) DEFAULT 'analyse', ADD COLUMN IF NOT EXISTS real_buy_price INTEGER, ADD COLUMN IF NOT EXISTS real_sell_price INTEGER, ADD COLUMN IF NOT EXISTS sold_in_days INTEGER, ADD COLUMN IF NOT EXISTS bought_at TIMESTAMP, ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP;`;
  analysisTableReady = true;
}

// --- CarmeloOpportunity ---
export type OpportunityStatus = 'nouveau' | 'contacte' | 'ecarte';
const opportunity = pgTable('CarmeloOpportunity', {
  id: serial('id').primaryKey(), email: varchar('email',{length:64}),
  vehicule: text('vehicule'), url: text('url'), askingPrice: integer('asking_price'),
  targetSell: integer('target_sell'), maxBuy: integer('max_buy'), marginAtAsk: integer('margin_at_ask'),
  zone: varchar('zone',{length:16}), positioning: varchar('positioning',{length:32}),
  contactMessage: text('contact_message'), status: varchar('status',{length:16}),
  createdAt: timestamp('created_at'),
});
export type OpportunityRecord = typeof opportunity.$inferSelect;
export type NewOpportunity = { vehicule: string; url?: string|null; askingPrice?: number|null; targetSell?: number|null; maxBuy?: number|null; marginAtAsk?: number|null; zone?: string|null; positioning?: string|null; contactMessage?: string|null; };

export async function saveOpportunity(email: string, data: NewOpportunity) {
  await ensureOpportunityTableExists();
  return await db.insert(opportunity).values({ email, vehicule: data.vehicule, url: data.url??null, askingPrice: data.askingPrice??null, targetSell: data.targetSell??null, maxBuy: data.maxBuy??null, marginAtAsk: data.marginAtAsk??null, zone: data.zone??null, positioning: data.positioning??null, contactMessage: data.contactMessage??null, status: 'nouveau' });
}
export async function getOpportunities(email: string, limit = 50) {
  await ensureOpportunityTableExists();
  return await db.select().from(opportunity).where(eq(opportunity.email,email)).orderBy(desc(opportunity.createdAt)).limit(limit);
}
export async function updateOpportunityStatus(id: number, email: string, status: OpportunityStatus) {
  await ensureOpportunityTableExists();
  return await db.update(opportunity).set({status}).where(and(eq(opportunity.id,id),eq(opportunity.email,email)));
}
let opportunityTableReady = false;
async function ensureOpportunityTableExists() {
  if (opportunityTableReady) return;
  await client`CREATE TABLE IF NOT EXISTS "CarmeloOpportunity" (id SERIAL PRIMARY KEY, email VARCHAR(64), vehicule TEXT, url TEXT, asking_price INTEGER, target_sell INTEGER, max_buy INTEGER, margin_at_ask INTEGER, zone VARCHAR(16), positioning VARCHAR(32), contact_message TEXT, status VARCHAR(16) DEFAULT 'nouveau', created_at TIMESTAMP DEFAULT NOW());`;
  opportunityTableReady = true;
}
```

### `app/actions.ts`
```typescript
'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from 'app/auth';
import { updateOutcome, updateOpportunityStatus, type VehicleStatus, type OpportunityStatus } from 'app/db';

export async function saveApiKey(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const apiKey = formData.get('apiKey');
  if (typeof apiKey !== 'string' || !apiKey.startsWith('sk-ant-')) return;
  cookies().set('gp_api_key', apiKey, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 60*60*24*365, path: '/' });
}

function toInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = parseInt(value.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}
function toDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const VALID_STATUSES: VehicleStatus[] = ['analyse', 'achete', 'vendu', 'refuse'];
export async function updateVehicleOutcome(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) return;
  const id = toInt(formData.get('id'));
  const status = formData.get('status');
  if (id==null || typeof status!=='string' || !VALID_STATUSES.includes(status as VehicleStatus)) return;
  await updateOutcome(id, session.user.email, { status: status as VehicleStatus, realBuyPrice: toInt(formData.get('realBuyPrice')), realSellPrice: toInt(formData.get('realSellPrice')), boughtAt: toDate(formData.get('boughtAt')), soldAt: toDate(formData.get('soldAt')) });
  revalidatePath('/carmelo/history');
}

const VALID_OPPORTUNITY_STATUSES: OpportunityStatus[] = ['nouveau', 'contacte', 'ecarte'];
export async function setOpportunityStatus(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) return;
  const id = toInt(formData.get('id'));
  const status = formData.get('status');
  if (id==null || typeof status!=='string' || !VALID_OPPORTUNITY_STATUSES.includes(status as OpportunityStatus)) return;
  await updateOpportunityStatus(id, session.user.email, status as OpportunityStatus);
  revalidatePath('/carmelo/opportunites');
}
```

### `app/api/carmelo/analyze/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildCarmeloSystemPrompt } from '@/lib/carmelo/system-prompt';
import { fetchListing } from '@/lib/carmelo/fetch-listing';
import { selectRelevant, buildMemoryBlock } from '@/lib/carmelo/memory';
import { auth } from 'app/auth';
import { cookies } from 'next/headers';
import { saveAnalysis, getAnalyses } from 'app/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;
  const apiKey = process.env.ANTHROPIC_API_KEY || cookies().get('gp_api_key')?.value;
  if (!apiKey) return NextResponse.json({ error: 'Clé API Anthropic non configurée.' }, { status: 500 });

  const body = await req.json().catch(() => null);
  const vehicule = typeof body?.vehicule === 'string' ? body.vehicule.trim() : '';
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!vehicule && !url) return NextResponse.json({ error: 'Fournissez une description ou un lien.' }, { status: 400 });

  let listingText = '';
  let listingNote = '';
  if (url) {
    const listing = await fetchListing(url);
    if (listing.ok && listing.text) listingText = listing.text;
    else listingNote = listing.error || 'Lien illisible.';
  }
  if (!vehicule && !listingText) return NextResponse.json({ error: `Impossible de lire le lien : ${listingNote}` }, { status: 422 });

  let memoryBlock = '';
  try {
    const past = await getAnalyses(email, 40);
    const relevant = selectRelevant(past, `${listingText} ${vehicule}`);
    memoryBlock = buildMemoryBlock(relevant);
  } catch (err) { console.error('Carmelo: mémoire indisponible', err); }

  const parts: string[] = [];
  if (url) parts.push(`LIEN DE L'ANNONCE : ${url}`);
  if (listingText) parts.push(`ANNONCE EXTRAITE DU LIEN :\n${listingText}`);
  else if (listingNote) parts.push(`(Lien non lisible : ${listingNote})`);
  if (vehicule) parts.push(`DESCRIPTION FOURNIE :\n${vehicule}`);
  if (memoryBlock) parts.push(memoryBlock);
  const userMessage = parts.join('\n\n');

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let full = '';
      try {
        const messageStream = client.messages.stream({ model: 'claude-opus-4-8', max_tokens: 2048, system: buildCarmeloSystemPrompt(), messages: [{ role: 'user', content: userMessage }] });
        for await (const event of messageStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        if (full.trim().length > 0) {
          try { await saveAnalysis(email, vehicule, full, url || null); }
          catch (err) { console.error('Carmelo: échec sauvegarde', err); }
        }
        controller.close();
      } catch (err) {
        console.error('Carmelo: erreur analyse', err);
        if (full.length === 0) controller.enqueue(encoder.encode("⚠️ Erreur lors de l'analyse."));
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' } });
}
```

### `app/api/carmelo/market/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { computeStats, evaluateOpportunity, positionPrice, POSITIONING_LABELS } from '@/lib/carmelo/market';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const askingPrice = Number(body?.askingPrice);
  const comparables: number[] = Array.isArray(body?.comparables)
    ? body.comparables.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n) && n > 0)
    : [];
  if (!Number.isFinite(askingPrice) || askingPrice <= 0) return NextResponse.json({ error: 'Prix demandé invalide.' }, { status: 400 });
  const stats = computeStats(comparables);
  if (!stats) return NextResponse.json({ error: 'Pas assez de comparables fiables (minimum 3 prix).' }, { status: 422 });
  const opp = evaluateOpportunity(askingPrice, stats);
  return NextResponse.json({ opportunity: opp, labels: { asking: POSITIONING_LABELS[positionPrice(askingPrice, stats)], target: POSITIONING_LABELS[opp.targetPositioning] } });
}
```

### `app/api/carmelo/contact/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from 'app/auth';
import { cookies } from 'next/headers';
import { buildContactDraftPrompt } from '@/lib/carmelo/contact-prompt';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const apiKey = process.env.ANTHROPIC_API_KEY || cookies().get('gp_api_key')?.value;
  if (!apiKey) return NextResponse.json({ error: 'Clé API non configurée.' }, { status: 500 });
  const body = await req.json().catch(() => null);
  const vehicule = typeof body?.vehicule === 'string' ? body.vehicule.trim() : '';
  if (!vehicule) return NextResponse.json({ error: 'Véhicule manquant.' }, { status: 400 });
  const prompt = buildContactDraftPrompt({
    vehicule, askingPrice: Number.isFinite(Number(body?.askingPrice)) ? Number(body.askingPrice) : null,
    targetPrice: Number.isFinite(Number(body?.targetPrice)) ? Number(body.targetPrice) : null,
    langue: body?.langue === 'nl' ? 'nl' : 'fr',
  });
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({ model: 'claude-opus-4-8', max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
    const content = response.content[0];
    return NextResponse.json({ message: content?.type === 'text' ? content.text : '' });
  } catch (err) {
    console.error('Carmelo: échec message', err);
    return NextResponse.json({ error: 'Échec de la rédaction.' }, { status: 500 });
  }
}
```

### `app/api/carmelo/opportunities/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { saveOpportunity } from 'app/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const vehicule = typeof body?.vehicule === 'string' ? body.vehicule.trim() : '';
  if (!vehicule) return NextResponse.json({ error: 'Véhicule manquant.' }, { status: 400 });
  const toInt = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; };
  try {
    await saveOpportunity(session.user.email, { vehicule, url: typeof body?.url==='string'?body.url:null, askingPrice: toInt(body?.askingPrice), targetSell: toInt(body?.targetSell), maxBuy: toInt(body?.maxBuy), marginAtAsk: toInt(body?.marginAtAsk), zone: typeof body?.zone==='string'?body.zone:null, positioning: typeof body?.positioning==='string'?body.positioning:null, contactMessage: typeof body?.contactMessage==='string'?body.contactMessage:null });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Carmelo: échec sauvegarde opportunité', err);
    return NextResponse.json({ error: "Échec de l'enregistrement." }, { status: 500 });
  }
}
```

### `app/auth.config.ts`
```typescript
import { NextAuthConfig } from 'next-auth';
export const authConfig = {
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      let isLoggedIn = !!auth?.user;
      let isOnDashboard =
        nextUrl.pathname.startsWith('/protected') ||
        nextUrl.pathname.startsWith('/carmelo') ||
        nextUrl.pathname.startsWith('/settings');
      if (isOnDashboard) { if (isLoggedIn) return true; return false; }
      else if (isLoggedIn) { return Response.redirect(new URL('/protected', nextUrl)); }
      return true;
    },
  },
} satisfies NextAuthConfig;
```

### `middleware.ts`
```typescript
import NextAuth from 'next-auth';
import { authConfig } from 'app/auth.config';
export default NextAuth(authConfig).auth;
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
```

### `package.json`
```json
{
  "scripts": { "dev": "next dev --turbo", "build": "next build", "start": "next start", "lint": "next lint", "test": "vitest run", "test:watch": "vitest" },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.36.3", "bcrypt-ts": "^5.0.0", "drizzle-orm": "^0.29.2",
    "geist": "^1.2.0", "next": "^14.0.4", "next-auth": "5.0.0-beta.4",
    "postgres": "^3.4.3", "react": "^18.2.0", "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.16", "eslint": "8.56.0", "eslint-config-next": "^14.0.4",
    "postcss": "^8.4.32", "tailwindcss": "^3.4.0", "typescript": "^5.3.3", "vitest": "^2.1.8"
  }
}
```

---

## QUESTIONS DE REVUE

Voici mes questions spécifiques auxquelles je veux que tu répondes en plus de l'audit global :

**Architecture / correctness :**
1. Le pattern `ensureTableExists` / `analysisTableReady` booléen est-il thread-safe en production Node.js avec Vercel (plusieurs instances simultanées) ? Quel risque ? Quel correctif ?
2. Le parseur `parseReport` se base sur les labels exacts du format de sortie Carmelo. Si le modèle dévie légèrement (langue, formatage), quels champs tombent à `null` en premier ? Comment durcir ça ?
3. Le streaming SSE dans `analyze/route.ts` — y a-t-il un risque de fuite mémoire ou de connexion zombie si le client ferme sa connexion avant la fin ?
4. `fetchListing` fait un `fetch` côté serveur Next.js avec un User-Agent de navigateur. Quels sont les risques réels en production ? Le timeout de 12s est-il cohérent avec les timeouts de Vercel ?

**Sécurité :**
5. La clé API Anthropic est stockée dans un cookie `httpOnly`. Est-ce une pratique acceptable ou faut-il passer par une variable d'environnement strictement ? Quels vecteurs d'attaque subsistent ?
6. La route `/api/carmelo/analyze` ne limite pas la taille du champ `vehicule`. Quel est le vecteur d'abus ? Comment le limiter proprement ?

**Métier / IA :**
7. Le `selectRelevant` dans `memory.ts` ne tient compte que de la marque et du statut vendu pour scorer la pertinence. Qu'est-ce qui manque comme signal de pertinence (année, gamme de prix, km, type de carburant) et comment l'ajouter sans exploser le contexte IA ?
8. Le `SELL_POSITION_FACTOR` à 0.96 est fixe. Dans quel contexte de marché ce facteur serait-il trop agressif ou trop conservateur ? Faut-il le rendre configurable dans `GP_CARS_PARAMS` ?
9. Les opportunités sauvées dans `CarmeloOpportunity` ne sont jamais liées à une analyse dans `CarmeloAnalysis`. Est-ce un oubli ou une décision volontaire ? Quel problème ça pose ?

**Ce qui manque :**
10. Qu'est-ce qui manquerait encore pour que cet agent soit utilisable en production quotidienne par deux personnes non techniques ?

---

Sois exhaustif, précis, et si tu trouves un bug réel, montre le correctif complet en TypeScript.
