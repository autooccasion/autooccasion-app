import { drizzle } from 'drizzle-orm/postgres-js';
import { pgTable, serial, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { eq, desc, and } from 'drizzle-orm';
import postgres from 'postgres';
import { genSaltSync, hashSync } from 'bcrypt-ts';
import { extractDecision } from '@/lib/carmelo/decision';
import { parseReport } from '@/lib/carmelo/parse';

export { extractDecision };

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle
let client = postgres(`${process.env.POSTGRES_URL!}?sslmode=require`);
let db = drizzle(client);

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
  const result = await client`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'User'
    );`;

  if (!result[0].exists) {
    await client`
      CREATE TABLE "User" (
        id SERIAL PRIMARY KEY,
        email VARCHAR(64),
        password VARCHAR(64)
      );`;
  }

  const table = pgTable('User', {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 64 }),
    password: varchar('password', { length: 64 }),
  });

  return table;
}

// --- Carmelo analysis history & learning memory ---

// Lifecycle of a vehicle through GP-CARS.
export type VehicleStatus = 'analyse' | 'achete' | 'vendu' | 'refuse';

const carmeloAnalysis = pgTable('CarmeloAnalysis', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 64 }),
  vehicule: text('vehicule'),
  url: text('url'),
  analyse: text('analyse'),
  decision: varchar('decision', { length: 16 }),
  // Structured fields parsed from Carmelo's report (the "memory").
  vehiculeResume: text('vehicule_resume'),
  make: varchar('make', { length: 48 }),
  marketPrice: integer('market_price'),
  recommendedMaxBuy: integer('recommended_max_buy'),
  estimatedMargin: integer('estimated_margin'),
  rotationScore: integer('rotation_score'),
  confidence: integer('confidence'),
  // Real-world outcome (the learning signal), filled in by the team.
  status: varchar('status', { length: 16 }),
  realBuyPrice: integer('real_buy_price'),
  realSellPrice: integer('real_sell_price'),
  soldInDays: integer('sold_in_days'),
  boughtAt: timestamp('bought_at'),
  soldAt: timestamp('sold_at'),
  createdAt: timestamp('created_at'),
});

export type CarmeloAnalysisRecord = typeof carmeloAnalysis.$inferSelect;

export async function saveAnalysis(
  email: string,
  vehicule: string,
  analyse: string,
  url?: string | null,
) {
  await ensureAnalysisTableExists();
  const parsed = parseReport(analyse);
  return await db.insert(carmeloAnalysis).values({
    email,
    vehicule,
    url: url || null,
    analyse,
    decision: parsed.decision,
    vehiculeResume: parsed.vehiculeResume,
    make: parsed.make,
    marketPrice: parsed.marketPrice,
    recommendedMaxBuy: parsed.recommendedMaxBuy,
    estimatedMargin: parsed.estimatedMargin,
    rotationScore: parsed.rotationScore,
    confidence: parsed.confidence,
    status: 'analyse',
  });
}

export async function getAnalyses(email: string, limit = 50) {
  await ensureAnalysisTableExists();
  return await db
    .select()
    .from(carmeloAnalysis)
    .where(eq(carmeloAnalysis.email, email))
    .orderBy(desc(carmeloAnalysis.createdAt))
    .limit(limit);
}

export type OutcomeUpdate = {
  status: VehicleStatus;
  realBuyPrice?: number | null;
  realSellPrice?: number | null;
  boughtAt?: Date | null;
  soldAt?: Date | null;
};

export async function updateOutcome(
  id: number,
  email: string,
  outcome: OutcomeUpdate,
) {
  await ensureAnalysisTableExists();

  // Derive days-in-stock from the available dates when the vehicle is sold.
  let soldInDays: number | null = null;
  if (outcome.status === 'vendu' && outcome.soldAt) {
    const rows = await db
      .select({ createdAt: carmeloAnalysis.createdAt })
      .from(carmeloAnalysis)
      .where(and(eq(carmeloAnalysis.id, id), eq(carmeloAnalysis.email, email)))
      .limit(1);
    const start = outcome.boughtAt || rows[0]?.createdAt || null;
    if (start) {
      const ms = outcome.soldAt.getTime() - new Date(start).getTime();
      soldInDays = Math.max(0, Math.round(ms / 86_400_000));
    }
  }

  return await db
    .update(carmeloAnalysis)
    .set({
      status: outcome.status,
      realBuyPrice: outcome.realBuyPrice ?? null,
      realSellPrice: outcome.realSellPrice ?? null,
      boughtAt: outcome.boughtAt ?? null,
      soldAt: outcome.soldAt ?? null,
      soldInDays,
    })
    .where(and(eq(carmeloAnalysis.id, id), eq(carmeloAnalysis.email, email)));
}

let analysisTableReady = false;

async function ensureAnalysisTableExists() {
  if (analysisTableReady) return;

  await client`
    CREATE TABLE IF NOT EXISTS "CarmeloAnalysis" (
      id SERIAL PRIMARY KEY,
      email VARCHAR(64),
      vehicule TEXT,
      analyse TEXT,
      decision VARCHAR(16),
      created_at TIMESTAMP DEFAULT NOW()
    );`;

  // Idempotent migration — add the memory/outcome columns if missing.
  await client`ALTER TABLE "CarmeloAnalysis"
    ADD COLUMN IF NOT EXISTS url TEXT,
    ADD COLUMN IF NOT EXISTS vehicule_resume TEXT,
    ADD COLUMN IF NOT EXISTS make VARCHAR(48),
    ADD COLUMN IF NOT EXISTS market_price INTEGER,
    ADD COLUMN IF NOT EXISTS recommended_max_buy INTEGER,
    ADD COLUMN IF NOT EXISTS estimated_margin INTEGER,
    ADD COLUMN IF NOT EXISTS rotation_score INTEGER,
    ADD COLUMN IF NOT EXISTS confidence INTEGER,
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) DEFAULT 'analyse',
    ADD COLUMN IF NOT EXISTS real_buy_price INTEGER,
    ADD COLUMN IF NOT EXISTS real_sell_price INTEGER,
    ADD COLUMN IF NOT EXISTS sold_in_days INTEGER,
    ADD COLUMN IF NOT EXISTS bought_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP;`;

  analysisTableReady = true;
}
