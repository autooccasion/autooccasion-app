import { drizzle } from 'drizzle-orm/postgres-js';
import { pgTable, serial, varchar, text, timestamp, integer, boolean, json } from 'drizzle-orm/pg-core';
import { eq, desc, and, gte, isNotNull } from 'drizzle-orm';
import postgres from 'postgres';
import { genSaltSync, hashSync } from 'bcrypt-ts';
import { extractDecision } from '@/lib/carmelo/decision';
import { parseReport } from '@/lib/carmelo/parse';
import type { VehicleStatus, AgentDecision, ControllerFlag, VehicleSummary } from '@/lib/agents/shared-types';

export { extractDecision };
export type { VehicleStatus, AgentDecision, VehicleSummary };

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

// --- Detected opportunities (daily good-deals feed) ---

export type OpportunityStatus = 'nouveau' | 'contacte' | 'ecarte';

const opportunity = pgTable('CarmeloOpportunity', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 64 }),
  vehicule: text('vehicule'),
  url: text('url'),
  askingPrice: integer('asking_price'),
  targetSell: integer('target_sell'),
  maxBuy: integer('max_buy'),
  marginAtAsk: integer('margin_at_ask'),
  zone: varchar('zone', { length: 16 }),
  positioning: varchar('positioning', { length: 32 }),
  contactMessage: text('contact_message'),
  status: varchar('status', { length: 16 }),
  createdAt: timestamp('created_at'),
});

export type OpportunityRecord = typeof opportunity.$inferSelect;

export type NewOpportunity = {
  vehicule: string;
  url?: string | null;
  askingPrice?: number | null;
  targetSell?: number | null;
  maxBuy?: number | null;
  marginAtAsk?: number | null;
  zone?: string | null;
  positioning?: string | null;
  contactMessage?: string | null;
};

export async function saveOpportunity(email: string, data: NewOpportunity) {
  await ensureOpportunityTableExists();
  return await db.insert(opportunity).values({
    email,
    vehicule: data.vehicule,
    url: data.url ?? null,
    askingPrice: data.askingPrice ?? null,
    targetSell: data.targetSell ?? null,
    maxBuy: data.maxBuy ?? null,
    marginAtAsk: data.marginAtAsk ?? null,
    zone: data.zone ?? null,
    positioning: data.positioning ?? null,
    contactMessage: data.contactMessage ?? null,
    status: 'nouveau',
  });
}

export async function getOpportunities(email: string, limit = 50) {
  await ensureOpportunityTableExists();
  return await db
    .select()
    .from(opportunity)
    .where(eq(opportunity.email, email))
    .orderBy(desc(opportunity.createdAt))
    .limit(limit);
}

export async function updateOpportunityStatus(
  id: number,
  email: string,
  status: OpportunityStatus,
) {
  await ensureOpportunityTableExists();
  return await db
    .update(opportunity)
    .set({ status })
    .where(and(eq(opportunity.id, id), eq(opportunity.email, email)));
}

let opportunityTableReady = false;

async function ensureOpportunityTableExists() {
  if (opportunityTableReady) return;
  await client`
    CREATE TABLE IF NOT EXISTS "CarmeloOpportunity" (
      id SERIAL PRIMARY KEY,
      email VARCHAR(64),
      vehicule TEXT,
      url TEXT,
      asking_price INTEGER,
      target_sell INTEGER,
      max_buy INTEGER,
      margin_at_ask INTEGER,
      zone VARCHAR(16),
      positioning VARCHAR(32),
      contact_message TEXT,
      status VARCHAR(16) DEFAULT 'nouveau',
      created_at TIMESTAMP DEFAULT NOW()
    );`;
  opportunityTableReady = true;
}

// ============================================================
// VEHICLE — central source of truth shared by all three agents
// ============================================================

const vehicle = pgTable('Vehicle', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 64 }),

  // --- Identification ---
  make: varchar('make', { length: 48 }),
  model: varchar('model', { length: 64 }),
  year: integer('year'),
  km: integer('km'),
  fuel: varchar('fuel', { length: 32 }),
  gearbox: varchar('gearbox', { length: 32 }),
  color: varchar('color', { length: 32 }),
  power: varchar('power', { length: 32 }),
  vin: varchar('vin', { length: 20 }),
  listingUrl: text('listing_url'),

  // --- Lifecycle ---
  status: varchar('status', { length: 16 }).$type<VehicleStatus>(),

  // --- Agent Achats ---
  askingPrice: integer('asking_price'),
  marketPrice: integer('market_price'),
  maxBuyPrice: integer('max_buy_price'),
  estimatedMargin: integer('estimated_margin'),
  rotationScore: integer('rotation_score'),
  confidence: integer('confidence'),
  decision: varchar('decision', { length: 16 }).$type<AgentDecision>(),
  analysisReport: text('analysis_report'),
  analysisId: integer('analysis_id'),   // FK → CarmeloAnalysis.id

  // --- Purchase reality ---
  realBuyPrice: integer('real_buy_price'),
  boughtAt: timestamp('bought_at'),

  // --- Agent Marketing ---
  listingTitle: text('listing_title'),
  listingDescription: text('listing_description'),
  listingPoints: json('listing_points').$type<string[]>(),
  listingTags: json('listing_tags').$type<string[]>(),
  publishedAt: timestamp('published_at'),
  listingExpiresAt: timestamp('listing_expires_at'),
  publishedPlatforms: json('published_platforms').$type<string[]>(),

  // --- Sale reality ---
  realSellPrice: integer('real_sell_price'),
  soldAt: timestamp('sold_at'),
  soldInDays: integer('sold_in_days'),
  realMargin: integer('real_margin'),

  // --- Agent Contrôleur ---
  controllerValidated: boolean('controller_validated'),
  requiresHumanValidation: boolean('requires_human_validation'),
  controllerFlags: json('controller_flags').$type<ControllerFlag[]>(),
  controllerNotes: text('controller_notes'),

  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

export type VehicleRecord = typeof vehicle.$inferSelect;

export type NewVehicleData = {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  km?: number | null;
  fuel?: string | null;
  gearbox?: string | null;
  color?: string | null;
  power?: string | null;
  vin?: string | null;
  listingUrl?: string | null;
  askingPrice?: number | null;
  marketPrice?: number | null;
  maxBuyPrice?: number | null;
  estimatedMargin?: number | null;
  rotationScore?: number | null;
  confidence?: number | null;
  decision?: AgentDecision | null;
  analysisReport?: string | null;
  analysisId?: number | null;
};

export async function createVehicle(email: string, data: NewVehicleData): Promise<VehicleRecord[]> {
  await ensureVehicleTableExists();
  return await db.insert(vehicle).values({
    email,
    status: 'analyse',
    make: data.make ?? null,
    model: data.model ?? null,
    year: data.year ?? null,
    km: data.km ?? null,
    fuel: data.fuel ?? null,
    gearbox: data.gearbox ?? null,
    color: data.color ?? null,
    power: data.power ?? null,
    vin: data.vin ?? null,
    listingUrl: data.listingUrl ?? null,
    askingPrice: data.askingPrice ?? null,
    marketPrice: data.marketPrice ?? null,
    maxBuyPrice: data.maxBuyPrice ?? null,
    estimatedMargin: data.estimatedMargin ?? null,
    rotationScore: data.rotationScore ?? null,
    confidence: data.confidence ?? null,
    decision: data.decision ?? 'INCONNU',
    analysisReport: data.analysisReport ?? null,
    analysisId: data.analysisId ?? null,
    controllerValidated: false,
    requiresHumanValidation: (data.confidence ?? 100) < 85,
  }).returning();
}

export async function getVehicles(email: string, limit = 100): Promise<VehicleRecord[]> {
  await ensureVehicleTableExists();
  return await db
    .select()
    .from(vehicle)
    .where(eq(vehicle.email, email))
    .orderBy(desc(vehicle.createdAt))
    .limit(limit);
}

export async function getVehicle(id: number, email: string): Promise<VehicleRecord | null> {
  await ensureVehicleTableExists();
  const rows = await db
    .select()
    .from(vehicle)
    .where(and(eq(vehicle.id, id), eq(vehicle.email, email)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateVehicleStatus(
  id: number,
  email: string,
  status: VehicleStatus,
  extra?: Partial<typeof vehicle.$inferInsert>,
) {
  await ensureVehicleTableExists();
  return await db
    .update(vehicle)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(and(eq(vehicle.id, id), eq(vehicle.email, email)));
}

export async function saveMarketingDraft(
  id: number,
  email: string,
  draft: { title: string; description: string; points: string[]; tags: string[] },
) {
  await ensureVehicleTableExists();
  return await db
    .update(vehicle)
    .set({
      listingTitle: draft.title,
      listingDescription: draft.description,
      listingPoints: draft.points,
      listingTags: draft.tags,
      updatedAt: new Date(),
    })
    .where(and(eq(vehicle.id, id), eq(vehicle.email, email)));
}

export async function recordSale(
  id: number,
  email: string,
  realSellPrice: number,
  soldAt: Date,
) {
  await ensureVehicleTableExists();
  const row = await getVehicle(id, email);
  if (!row) return;

  const start = row.boughtAt || row.publishedAt || row.createdAt;
  const soldInDays = start
    ? Math.max(0, Math.round((soldAt.getTime() - new Date(start).getTime()) / 86_400_000))
    : null;
  const realMargin =
    row.realBuyPrice != null
      ? realSellPrice - row.realBuyPrice - 1005 // plancher frais approx
      : null;

  return await db
    .update(vehicle)
    .set({ status: 'vendu', realSellPrice, soldAt, soldInDays, realMargin, updatedAt: new Date() })
    .where(and(eq(vehicle.id, id), eq(vehicle.email, email)));
}

export async function saveControllerResult(
  id: number,
  email: string,
  result: { validated: boolean; requiresHuman: boolean; flags: ControllerFlag[]; notes: string },
) {
  await ensureVehicleTableExists();
  return await db
    .update(vehicle)
    .set({
      controllerValidated: result.validated,
      requiresHumanValidation: result.requiresHuman,
      controllerFlags: result.flags,
      controllerNotes: result.notes,
      updatedAt: new Date(),
    })
    .where(and(eq(vehicle.id, id), eq(vehicle.email, email)));
}

// Returns a lightweight summary array for analytics.
export async function getVehicleSummaries(email: string): Promise<VehicleSummary[]> {
  await ensureVehicleTableExists();
  const rows = await db
    .select({
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      km: vehicle.km,
      fuel: vehicle.fuel,
      status: vehicle.status,
      askingPrice: vehicle.askingPrice,
      maxBuyPrice: vehicle.maxBuyPrice,
      realBuyPrice: vehicle.realBuyPrice,
      realSellPrice: vehicle.realSellPrice,
      decision: vehicle.decision,
      soldInDays: vehicle.soldInDays,
      realMargin: vehicle.realMargin,
    })
    .from(vehicle)
    .where(eq(vehicle.email, email))
    .orderBy(desc(vehicle.createdAt));

  return rows.map((r) => ({
    id: r.id,
    make: r.make ?? null,
    model: r.model ?? null,
    year: r.year ?? null,
    km: r.km ?? null,
    fuel: r.fuel ?? null,
    status: (r.status ?? 'analyse') as VehicleStatus,
    askingPrice: r.askingPrice ?? null,
    maxBuyPrice: r.maxBuyPrice ?? null,
    realBuyPrice: r.realBuyPrice ?? null,
    realSellPrice: r.realSellPrice ?? null,
    decision: (r.decision ?? 'INCONNU') as AgentDecision,
    soldInDays: r.soldInDays ?? null,
    realMargin: r.realMargin ?? null,
  }));
}

let vehicleTableReady = false;

async function ensureVehicleTableExists() {
  if (vehicleTableReady) return;
  await client`
    CREATE TABLE IF NOT EXISTS "Vehicle" (
      id SERIAL PRIMARY KEY,
      email VARCHAR(64),
      make VARCHAR(48), model VARCHAR(64), year INTEGER, km INTEGER,
      fuel VARCHAR(32), gearbox VARCHAR(32), color VARCHAR(32), power VARCHAR(32),
      vin VARCHAR(20), listing_url TEXT,
      status VARCHAR(16) DEFAULT 'analyse',
      asking_price INTEGER, market_price INTEGER, max_buy_price INTEGER,
      estimated_margin INTEGER, rotation_score INTEGER, confidence INTEGER,
      decision VARCHAR(16) DEFAULT 'INCONNU',
      analysis_report TEXT, analysis_id INTEGER,
      real_buy_price INTEGER, bought_at TIMESTAMP,
      listing_title TEXT, listing_description TEXT,
      listing_points JSONB, listing_tags JSONB,
      published_at TIMESTAMP, listing_expires_at TIMESTAMP,
      published_platforms JSONB,
      real_sell_price INTEGER, sold_at TIMESTAMP,
      sold_in_days INTEGER, real_margin INTEGER,
      controller_validated BOOLEAN DEFAULT FALSE,
      requires_human_validation BOOLEAN DEFAULT FALSE,
      controller_flags JSONB, controller_notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );`;
  vehicleTableReady = true;
}
