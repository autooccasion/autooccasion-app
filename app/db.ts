import { drizzle } from 'drizzle-orm/postgres-js';
import { pgTable, serial, varchar, text, timestamp, integer, boolean, json } from 'drizzle-orm/pg-core';
import { eq, desc, and, inArray } from 'drizzle-orm';
import postgres from 'postgres';
import { genSaltSync, hashSync } from 'bcrypt-ts';
import { extractDecision } from '@/lib/carmelo/decision';
import { parseReport } from '@/lib/carmelo/parse';
import { PLANCHER_FRAIS } from '@/lib/carmelo/config';
import type { VehicleStatus, AgentDecision, ControllerFlag, VehicleSummary } from '@/lib/agents/shared-types';

export { extractDecision };
export type { VehicleStatus, AgentDecision, VehicleSummary };

let _client: ReturnType<typeof postgres> | undefined;
let _db: ReturnType<typeof drizzle> | undefined;

function getClient() {
  if (!_client) _client = postgres(`${process.env.POSTGRES_URL!}?sslmode=require`);
  return _client;
}

function getDb() {
  if (!_db) _db = drizzle(getClient());
  return _db;
}

// ============================================================
// SCHEMA — module-level, never recreated at runtime
// ============================================================

const users = pgTable('User', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 64 }),
  password: varchar('password', { length: 64 }),
});

const carmeloAnalysis = pgTable('CarmeloAnalysis', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 64 }),
  vehicule: text('vehicule'),
  url: text('url'),
  analyse: text('analyse'),
  decision: varchar('decision', { length: 16 }),
  vehiculeResume: text('vehicule_resume'),
  make: varchar('make', { length: 48 }),
  marketPrice: integer('market_price'),
  recommendedMaxBuy: integer('recommended_max_buy'),
  estimatedMargin: integer('estimated_margin'),
  rotationScore: integer('rotation_score'),
  confidence: integer('confidence'),
  status: varchar('status', { length: 16 }),
  realBuyPrice: integer('real_buy_price'),
  realSellPrice: integer('real_sell_price'),
  soldInDays: integer('sold_in_days'),
  boughtAt: timestamp('bought_at'),
  soldAt: timestamp('sold_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type CarmeloAnalysisRecord = typeof carmeloAnalysis.$inferSelect;

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
  createdAt: timestamp('created_at').defaultNow(),
});

export type OpportunityRecord = typeof opportunity.$inferSelect;

const vehicle = pgTable('Vehicle', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 64 }),
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
  status: varchar('status', { length: 16 }).$type<VehicleStatus>(),
  askingPrice: integer('asking_price'),
  marketPrice: integer('market_price'),
  maxBuyPrice: integer('max_buy_price'),
  estimatedMargin: integer('estimated_margin'),
  rotationScore: integer('rotation_score'),
  confidence: integer('confidence'),
  decision: varchar('decision', { length: 16 }).$type<AgentDecision>(),
  analysisReport: text('analysis_report'),
  analysisId: integer('analysis_id'),
  realBuyPrice: integer('real_buy_price'),
  boughtAt: timestamp('bought_at'),
  listingTitle: text('listing_title'),
  listingDescription: text('listing_description'),
  listingPoints: json('listing_points').$type<string[]>(),
  listingTags: json('listing_tags').$type<string[]>(),
  publishedAt: timestamp('published_at'),
  listingExpiresAt: timestamp('listing_expires_at'),
  publishedPlatforms: json('published_platforms').$type<string[]>(),
  realSellPrice: integer('real_sell_price'),
  soldAt: timestamp('sold_at'),
  soldInDays: integer('sold_in_days'),
  realMargin: integer('real_margin'),
  controllerValidated: boolean('controller_validated'),
  requiresHumanValidation: boolean('requires_human_validation'),
  controllerFlags: json('controller_flags').$type<ControllerFlag[]>(),
  controllerNotes: text('controller_notes'),
  analysisFeedback: varchar('analysis_feedback', { length: 16 }).$type<'correct' | 'incorrect'>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type VehicleRecord = typeof vehicle.$inferSelect;

const madoreLead = pgTable('MadoreLead', {
  id: serial('id').primaryKey(),
  prospectName:       varchar('prospect_name', { length: 128 }),
  prospectPhone:      varchar('prospect_phone', { length: 32 }),
  prospectEmail:      varchar('prospect_email', { length: 128 }),
  vehicleSearch:      text('vehicle_search'),
  budget:             integer('budget'),
  financing:          boolean('financing'),
  tradeIn:            boolean('trade_in'),
  buyDelay:           varchar('buy_delay', { length: 64 }),
  postalCode:         varchar('postal_code', { length: 16 }),
  score:              integer('score'),
  priority:           varchar('priority', { length: 16 }),
  saleProbability:    integer('sale_probability'),
  summary:            text('summary'),
  actionRecommended:  text('action_recommended'),
  conversation:       json('conversation').$type<{role:string;content:string}[]>(),
  status:             varchar('status', { length: 16 }),
  createdAt:          timestamp('created_at').defaultNow(),
  updatedAt:          timestamp('updated_at').defaultNow(),
});

export type MadoreLeadRecord = typeof madoreLead.$inferSelect;

const systemEvent = pgTable('SystemEvent', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 64 }).notNull(),   // 'lead.rouge', 'opportunite.or', 'stock.immobilise', 'analyse.low_confidence'
  source: varchar('source', { length: 32 }).notNull(), // 'madore', 'carmelo', 'scanner', 'marketing', 'controller'
  payload: json('payload').$type<Record<string, unknown>>(),
  processed: boolean('processed').default(false),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type SystemEventRecord = typeof systemEvent.$inferSelect;

const priceHistory = pgTable('PriceHistory', {
  id: serial('id').primaryKey(),
  listingUrl: text('listing_url').notNull(),
  email: varchar('email', { length: 64 }).notNull(),
  price: integer('price').notNull(),
  vehicleLabel: text('vehicle_label'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type PriceHistoryRecord = typeof priceHistory.$inferSelect;

const demandSignal = pgTable('DemandSignal', {
  id: serial('id').primaryKey(),
  vehicleType: varchar('vehicle_type', { length: 64 }),    // 'SUV', 'citadine', 'berline', etc.
  fuelPreference: varchar('fuel_preference', { length: 32 }),
  gearboxPreference: varchar('gearbox_preference', { length: 32 }),
  budgetMin: integer('budget_min'),
  budgetMax: integer('budget_max'),
  leadId: integer('lead_id'),
  priority: varchar('priority', { length: 16 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export type DemandSignalRecord = typeof demandSignal.$inferSelect;

const vehicleEvent = pgTable('VehicleEvent', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').notNull(),
  email: varchar('email', { length: 64 }).notNull(),
  fromStatus: varchar('from_status', { length: 16 }),
  toStatus: varchar('to_status', { length: 16 }).notNull(),
  actorType: varchar('actor_type', { length: 16 }).notNull(),
  agentName: varchar('agent_name', { length: 32 }),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type VehicleEventRecord = typeof vehicleEvent.$inferSelect;

// ============================================================
// SINGLE SCHEMA INIT
// Promise singleton: concurrent requests in the same Node.js process
// all await the same Promise — no duplicate DDL, no race condition.
// ============================================================

let _schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (_schemaReady) return _schemaReady;
  _schemaReady = (async () => {
    await getClient()`
      CREATE TABLE IF NOT EXISTS "User" (
        id SERIAL PRIMARY KEY,
        email VARCHAR(64),
        password VARCHAR(64)
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "CarmeloAnalysis" (
        id SERIAL PRIMARY KEY,
        email VARCHAR(64),
        vehicule TEXT,
        analyse TEXT,
        decision VARCHAR(16),
        created_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      ALTER TABLE "CarmeloAnalysis"
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
        ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP`;

    await getClient()`
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
      )`;

    await getClient()`
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
        analysis_feedback VARCHAR(16),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      ALTER TABLE "Vehicle"
        ADD COLUMN IF NOT EXISTS analysis_feedback VARCHAR(16)`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "VehicleEvent" (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER NOT NULL,
        email VARCHAR(64) NOT NULL,
        from_status VARCHAR(16),
        to_status VARCHAR(16) NOT NULL,
        actor_type VARCHAR(16) NOT NULL DEFAULT 'human',
        agent_name VARCHAR(32),
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "MadoreLead" (
        id SERIAL PRIMARY KEY,
        prospect_name VARCHAR(128),
        prospect_phone VARCHAR(32),
        prospect_email VARCHAR(128),
        vehicle_search TEXT,
        budget INTEGER,
        financing BOOLEAN,
        trade_in BOOLEAN,
        buy_delay VARCHAR(64),
        postal_code VARCHAR(16),
        score INTEGER,
        priority VARCHAR(16),
        sale_probability INTEGER,
        summary TEXT,
        action_recommended TEXT,
        conversation JSONB,
        status VARCHAR(16) DEFAULT 'nouveau',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "SystemEvent" (
        id SERIAL PRIMARY KEY,
        type VARCHAR(64) NOT NULL,
        source VARCHAR(32) NOT NULL,
        payload JSONB,
        processed BOOLEAN DEFAULT false,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "PriceHistory" (
        id SERIAL PRIMARY KEY,
        listing_url TEXT NOT NULL,
        email VARCHAR(64) NOT NULL,
        price INTEGER NOT NULL,
        vehicle_label TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "DemandSignal" (
        id SERIAL PRIMARY KEY,
        vehicle_type VARCHAR(64),
        fuel_preference VARCHAR(32),
        gearbox_preference VARCHAR(32),
        budget_min INTEGER,
        budget_max INTEGER,
        lead_id INTEGER,
        priority VARCHAR(16),
        created_at TIMESTAMP DEFAULT NOW()
      )`;
  })();
  return _schemaReady;
}

// ============================================================
// USER
// ============================================================

export async function getUser(email: string) {
  await ensureSchema();
  return await getDb().select().from(users).where(eq(users.email, email));
}

export async function createUser(email: string, password: string) {
  await ensureSchema();
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);
  return await getDb().insert(users).values({ email, password: hash });
}

// ============================================================
// CARMELO ANALYSIS
// ============================================================

export async function saveAnalysis(
  email: string,
  vehicule: string,
  analyse: string,
  url?: string | null,
): Promise<CarmeloAnalysisRecord[]> {
  await ensureSchema();
  const parsed = parseReport(analyse);
  return await getDb().insert(carmeloAnalysis).values({
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
  }).returning();
}

export async function getAnalyses(email: string, limit = 50) {
  await ensureSchema();
  return await getDb()
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

export async function updateOutcome(id: number, email: string, outcome: OutcomeUpdate) {
  await ensureSchema();
  let soldInDays: number | null = null;
  if (outcome.status === 'vendu' && outcome.soldAt) {
    const rows = await getDb()
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
  return await getDb()
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

// ============================================================
// OPPORTUNITY
// ============================================================

export type OpportunityStatus = 'nouveau' | 'contacte' | 'ecarte';

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
  await ensureSchema();
  return await getDb().insert(opportunity).values({
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
  await ensureSchema();
  return await getDb()
    .select()
    .from(opportunity)
    .where(eq(opportunity.email, email))
    .orderBy(desc(opportunity.createdAt))
    .limit(limit);
}

export async function updateOpportunityStatus(id: number, email: string, status: OpportunityStatus) {
  await ensureSchema();
  return await getDb()
    .update(opportunity)
    .set({ status })
    .where(and(eq(opportunity.id, id), eq(opportunity.email, email)));
}

// ============================================================
// VEHICLE — source de vérité centrale
// ============================================================

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
  await ensureSchema();
  return await getDb().insert(vehicle).values({
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
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();
}

export async function getVehicles(email: string, limit = 100): Promise<VehicleRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(vehicle)
    .where(eq(vehicle.email, email))
    .orderBy(desc(vehicle.createdAt))
    .limit(limit);
}

export async function getVehicle(id: number, email: string): Promise<VehicleRecord | null> {
  await ensureSchema();
  const rows = await getDb()
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
  await ensureSchema();
  const current = await getVehicle(id, email);
  await getDb()
    .update(vehicle)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(and(eq(vehicle.id, id), eq(vehicle.email, email)));
  if (current) {
    await logVehicleEvent(
      id, email,
      (current.status ?? null) as VehicleStatus | null,
      status,
    );
  }
}

export async function saveMarketingDraft(
  id: number,
  email: string,
  draft: { title: string; description: string; points: string[]; tags: string[] },
) {
  await ensureSchema();
  return await getDb()
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

export async function recordSale(id: number, email: string, realSellPrice: number, soldAt: Date) {
  await ensureSchema();
  const row = await getVehicle(id, email);
  if (!row) return;

  const start = row.boughtAt || row.publishedAt || row.createdAt;
  const soldInDays = start
    ? Math.max(0, Math.round((soldAt.getTime() - new Date(start).getTime()) / 86_400_000))
    : null;
  // PLANCHER_FRAIS = 405 € incompressibles (CT 105 + préparation 100 + publicité 200)
  const realMargin = row.realBuyPrice != null
    ? realSellPrice - row.realBuyPrice - PLANCHER_FRAIS
    : null;

  await getDb()
    .update(vehicle)
    .set({ status: 'vendu', realSellPrice, soldAt, soldInDays, realMargin, updatedAt: new Date() })
    .where(and(eq(vehicle.id, id), eq(vehicle.email, email)));

  await logVehicleEvent(
    id, email,
    (row.status ?? null) as VehicleStatus | null,
    'vendu',
    'human',
    undefined,
    `Vendu ${realSellPrice} €`,
  );
}

export async function saveControllerResult(
  id: number,
  email: string,
  result: { validated: boolean; requiresHuman: boolean; flags: ControllerFlag[]; notes: string },
) {
  await ensureSchema();
  return await getDb()
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

// Lightweight projection for analytics — excludes heavy text fields.
export async function getVehicleSummaries(email: string): Promise<VehicleSummary[]> {
  await ensureSchema();
  const rows = await getDb()
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
      estimatedMargin: vehicle.estimatedMargin,
      confidence: vehicle.confidence,
      realBuyPrice: vehicle.realBuyPrice,
      realSellPrice: vehicle.realSellPrice,
      decision: vehicle.decision,
      soldInDays: vehicle.soldInDays,
      realMargin: vehicle.realMargin,
      publishedAt: vehicle.publishedAt,
      soldAt: vehicle.soldAt,
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
    estimatedMargin: r.estimatedMargin ?? null,
    confidence: r.confidence ?? null,
    realBuyPrice: r.realBuyPrice ?? null,
    realSellPrice: r.realSellPrice ?? null,
    decision: (r.decision ?? 'INCONNU') as AgentDecision,
    soldInDays: r.soldInDays ?? null,
    realMargin: r.realMargin ?? null,
    publishedAt: r.publishedAt ?? null,
    soldAt: r.soldAt ?? null,
  }));
}

// ============================================================
// VEHICLE EVENTS — journal d'audit
// ============================================================

export async function logVehicleEvent(
  vehicleId: number,
  email: string,
  fromStatus: VehicleStatus | null,
  toStatus: VehicleStatus,
  actorType: 'human' | 'agent' = 'human',
  agentName?: string,
  note?: string,
) {
  await ensureSchema();
  return await getDb().insert(vehicleEvent).values({
    vehicleId,
    email,
    fromStatus,
    toStatus,
    actorType,
    agentName: agentName ?? null,
    note: note ?? null,
  });
}

export async function getVehicleEvents(vehicleId: number, email: string): Promise<VehicleEventRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(vehicleEvent)
    .where(and(eq(vehicleEvent.vehicleId, vehicleId), eq(vehicleEvent.email, email)))
    .orderBy(desc(vehicleEvent.createdAt));
}

export async function updateVehicleFeedback(
  id: number,
  email: string,
  feedback: 'correct' | 'incorrect',
) {
  await ensureSchema();
  return await getDb()
    .update(vehicle)
    .set({ analysisFeedback: feedback, updatedAt: new Date() })
    .where(and(eq(vehicle.id, id), eq(vehicle.email, email)));
}

export async function getVehicleByListingUrl(
  email: string,
  listingUrl: string,
): Promise<{ id: number } | null> {
  await ensureSchema();
  const rows = await getDb()
    .select({ id: vehicle.id })
    .from(vehicle)
    .where(and(eq(vehicle.email, email), eq(vehicle.listingUrl, listingUrl)))
    .limit(1);
  return rows[0] ?? null;
}

// Returns Vehicle records shaped as LearningRecords for Carmelo's memory.
// Replaces getAnalyses() so that imported history feeds the RAG context.
export async function getVehiclesForMemory(email: string, limit = 60) {
  await ensureSchema();
  const rows = await getDb()
    .select({
      make:             vehicle.make,
      model:            vehicle.model,
      year:             vehicle.year,
      status:           vehicle.status,
      decision:         vehicle.decision,
      maxBuyPrice:      vehicle.maxBuyPrice,
      realBuyPrice:     vehicle.realBuyPrice,
      realSellPrice:    vehicle.realSellPrice,
      soldInDays:       vehicle.soldInDays,
      analysisFeedback: vehicle.analysisFeedback,
      createdAt:        vehicle.createdAt,
    })
    .from(vehicle)
    .where(eq(vehicle.email, email))
    .orderBy(desc(vehicle.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    vehiculeResume: [r.make, r.model, r.year].filter(Boolean).join(' ') || null,
    make:             r.make ?? null,
    decision:         r.decision ?? null,
    recommendedMaxBuy: r.maxBuyPrice ?? null,
    status:           r.status ?? null,
    realBuyPrice:     r.realBuyPrice ?? null,
    realSellPrice:    r.realSellPrice ?? null,
    soldInDays:       r.soldInDays ?? null,
    analysisFeedback: (r.analysisFeedback as 'correct' | 'incorrect' | null) ?? null,
    createdAt:        r.createdAt ?? null,
  }));
}

export type ImportRow = {
  make: string;
  model?: string | null;
  year?: number | null;
  km?: number | null;
  fuel?: string | null;
  gearbox?: string | null;
  color?: string | null;
  askingPrice?: number | null;
  realBuyPrice?: number | null;
  realSellPrice?: number | null;
  soldInDays?: number | null;
  boughtAt?: Date | null;
  soldAt?: Date | null;
  status: VehicleStatus;
  listingUrl?: string | null;
};

// ============================================================
// STOCK — véhicules disponibles pour MADORE
// ============================================================

export async function getStockVehicles(ownerEmail: string) {
  await ensureSchema();
  return await getDb()
    .select()
    .from(vehicle)
    .where(and(eq(vehicle.email, ownerEmail), inArray(vehicle.status as any, ['en_stock', 'publie'])))
    .orderBy(desc(vehicle.createdAt))
    .limit(50);
}

// ============================================================
// MADORE LEADS
// ============================================================

export type SaveLeadInput = {
  prospectName?: string | null;
  prospectPhone?: string | null;
  prospectEmail?: string | null;
  vehicleSearch?: string | null;
  budget?: number | null;
  financing?: boolean | null;
  tradeIn?: boolean | null;
  buyDelay?: string | null;
  postalCode?: string | null;
  score?: number | null;
  priority?: string | null;
  saleProbability?: number | null;
  summary?: string | null;
  actionRecommended?: string | null;
  conversation?: {role:string;content:string}[] | null;
};

export async function saveLead(input: SaveLeadInput): Promise<MadoreLeadRecord[]> {
  await ensureSchema();
  return await getDb().insert(madoreLead).values({
    ...input,
    status: 'nouveau',
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();
}

export async function getLeads(limit = 100): Promise<MadoreLeadRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(madoreLead)
    .orderBy(desc(madoreLead.createdAt))
    .limit(limit);
}

export async function updateLeadStatus(id: number, status: string): Promise<void> {
  await ensureSchema();
  await getDb().update(madoreLead).set({ status, updatedAt: new Date() }).where(eq(madoreLead.id, id));
}

export async function bulkImportVehicles(
  email: string,
  rows: ImportRow[],
): Promise<{ imported: number; errors: { row: number; error: string }[] }> {
  await ensureSchema();
  let imported = 0;
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      const realMargin =
        r.realBuyPrice != null && r.realSellPrice != null
          ? r.realSellPrice - r.realBuyPrice - PLANCHER_FRAIS
          : null;

      await getDb().insert(vehicle).values({
        email,
        make:         r.make,
        model:        r.model ?? null,
        year:         r.year ?? null,
        km:           r.km ?? null,
        fuel:         r.fuel ?? null,
        gearbox:      r.gearbox ?? null,
        color:        r.color ?? null,
        listingUrl:   r.listingUrl ?? null,
        status:       r.status,
        askingPrice:  r.askingPrice ?? null,
        realBuyPrice: r.realBuyPrice ?? null,
        boughtAt:     r.boughtAt ?? null,
        realSellPrice: r.realSellPrice ?? null,
        soldAt:       r.soldAt ?? null,
        soldInDays:   r.soldInDays ?? null,
        realMargin,
        decision:     'INCONNU',
        controllerValidated: false,
        requiresHumanValidation: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      imported++;
    } catch (err: unknown) {
      errors.push({ row: i + 2, error: err instanceof Error ? err.message : 'Erreur inconnue' });
    }
  }

  return { imported, errors };
}

// ============================================================
// SYSTEM EVENTS — bus d'événements inter-agents
// ============================================================

export async function publishEvent(
  type: string,
  source: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await ensureSchema();
  await getDb().insert(systemEvent).values({ type, source, payload, processed: false });
}

export async function getPendingEvents(limit = 50): Promise<SystemEventRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(systemEvent)
    .where(eq(systemEvent.processed, false))
    .orderBy(systemEvent.createdAt)
    .limit(limit);
}

export async function markEventProcessed(id: number): Promise<void> {
  await ensureSchema();
  await getDb()
    .update(systemEvent)
    .set({ processed: true, processedAt: new Date() })
    .where(eq(systemEvent.id, id));
}

export async function getRecentEvents(limit = 100): Promise<SystemEventRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(systemEvent)
    .orderBy(desc(systemEvent.createdAt))
    .limit(limit);
}

// ============================================================
// PRICE HISTORY — historique des prix par URL d'annonce
// ============================================================

export async function recordPricePoint(
  email: string,
  listingUrl: string,
  price: number,
  vehicleLabel?: string,
): Promise<void> {
  await ensureSchema();
  await getDb().insert(priceHistory).values({ email, listingUrl, price, vehicleLabel: vehicleLabel ?? null });
}

export async function getPriceHistory(
  email: string,
  listingUrl: string,
): Promise<PriceHistoryRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(priceHistory)
    .where(and(eq(priceHistory.email, email), eq(priceHistory.listingUrl, listingUrl)))
    .orderBy(desc(priceHistory.createdAt));
}

// Returns the last known price for a listing URL, or null if never seen.
export async function getLastKnownPrice(
  email: string,
  listingUrl: string,
): Promise<number | null> {
  await ensureSchema();
  const rows = await getDb()
    .select({ price: priceHistory.price })
    .from(priceHistory)
    .where(and(eq(priceHistory.email, email), eq(priceHistory.listingUrl, listingUrl)))
    .orderBy(desc(priceHistory.createdAt))
    .limit(1);
  return rows[0]?.price ?? null;
}

// ============================================================
// DEMAND SIGNALS — ce que les prospects MADORE recherchent
// ============================================================

export async function saveDemandSignal(signal: {
  vehicleType?: string | null;
  fuelPreference?: string | null;
  gearboxPreference?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  leadId?: number | null;
  priority?: string | null;
}): Promise<void> {
  await ensureSchema();
  await getDb().insert(demandSignal).values({
    vehicleType: signal.vehicleType ?? null,
    fuelPreference: signal.fuelPreference ?? null,
    gearboxPreference: signal.gearboxPreference ?? null,
    budgetMin: signal.budgetMin ?? null,
    budgetMax: signal.budgetMax ?? null,
    leadId: signal.leadId ?? null,
    priority: signal.priority ?? null,
  });
}

// Returns aggregated demand signals from the last 30 days for Carmelo's context.
export async function getRecentDemandSignals(limit = 20): Promise<DemandSignalRecord[]> {
  await ensureSchema();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  // Use raw SQL for date comparison since drizzle gte needs import
  const rows = await getClient()`
    SELECT * FROM "DemandSignal"
    WHERE created_at >= ${since}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows as DemandSignalRecord[];
}

// Returns a formatted string summarizing demand for Carmelo's system prompt injection.
export async function buildDemandBlock(): Promise<string> {
  const signals = await getRecentDemandSignals(30);
  if (signals.length === 0) return '';

  const typeCount: Record<string, number> = {};
  const budgets: number[] = [];

  for (const s of signals) {
    if (s.vehicleType) typeCount[s.vehicleType] = (typeCount[s.vehicleType] ?? 0) + 1;
    if (s.budgetMax) budgets.push(s.budgetMax);
  }

  const topTypes = Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, count]) => `${type} (${count} demande${count > 1 ? 's' : ''})`)
    .join(', ');

  const avgBudget = budgets.length > 0
    ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length)
    : null;

  const lines = [`## DEMANDE PROSPECTS MADORE (30 derniers jours — ${signals.length} leads)`];
  if (topTypes) lines.push(`Types les plus recherchés : ${topTypes}`);
  if (avgBudget) lines.push(`Budget moyen des prospects : ${avgBudget.toLocaleString('fr-BE')} €`);
  lines.push('→ Priorise les achats qui correspondent à cette demande réelle.');

  return lines.join('\n');
}
