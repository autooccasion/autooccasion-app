import { drizzle } from 'drizzle-orm/postgres-js';
import { pgTable, serial, varchar, text, timestamp, integer, boolean, json } from 'drizzle-orm/pg-core';
import { eq, desc, and, notInArray } from 'drizzle-orm';
import postgres from 'postgres';
import { genSaltSync, hashSync } from 'bcrypt-ts';
import { extractDecision } from '@/lib/carmelo/decision';
import { parseReport } from '@/lib/carmelo/parse';
import { PLANCHER_FRAIS } from '@/lib/carmelo/config';
import type { VehicleStatus, AgentDecision, ControllerFlag, VehicleSummary } from '@/lib/agents/shared-types';

export { extractDecision };
export type { VehicleStatus, AgentDecision, VehicleSummary };

export type WorkshopJobType = 'entretien' | 'pneus' | 'freins' | 'carrosserie' | 'ct' | 'nettoyage' | 'autre';
export type WorkshopJobStatus = 'planifie' | 'en_cours' | 'termine' | 'annule';
export type SupplierType = 'mecano' | 'carrossier' | 'pneus' | 'pieces' | 'autre';

export type BuyerType = 'particulier' | 'professionnel';
export type WarrantyType = 'legale' | 'contractuelle' | 'aucune';
export type WarrantyCaseStatus = 'ouvert' | 'en_cours' | 'resolu' | 'rejete' | 'litige';
export type WarrantyCaseSeverity = 'mineur' | 'modere' | 'grave' | 'critique';

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
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type VehicleRecord = typeof vehicle.$inferSelect;

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

const workshopJob = pgTable('WorkshopJob', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').notNull(),
  email: varchar('email', { length: 64 }).notNull(),
  type: varchar('type', { length: 32 }).notNull().$type<WorkshopJobType>(),
  description: text('description'),
  supplier: varchar('supplier', { length: 128 }),
  estimatedCost: integer('estimated_cost'),
  actualCost: integer('actual_cost'),
  status: varchar('status', { length: 16 }).notNull().$type<WorkshopJobStatus>(),
  scheduledAt: timestamp('scheduled_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

const workshopSupplier = pgTable('WorkshopSupplier', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 64 }).notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  phone: varchar('phone', { length: 32 }),
  contactEmail: varchar('contact_email', { length: 128 }),
  type: varchar('type', { length: 32 }).$type<SupplierType>(),
  notes: text('notes'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

const warranty = pgTable('Warranty', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').notNull(),
  email: varchar('email', { length: 64 }).notNull(),
  buyerName: varchar('buyer_name', { length: 128 }),
  buyerEmail: varchar('buyer_email', { length: 128 }),
  buyerPhone: varchar('buyer_phone', { length: 32 }),
  buyerType: varchar('buyer_type', { length: 16 }).$type<BuyerType>().default('particulier'),
  warrantyType: varchar('warranty_type', { length: 16 }).$type<WarrantyType>().default('legale'),
  soldPrice: integer('sold_price'),
  soldAt: timestamp('sold_at').notNull(),
  legalExpiresAt: timestamp('legal_expires_at').notNull(),
  contractExpiresAt: timestamp('contract_expires_at'),
  notes: text('notes'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

const warrantyCase = pgTable('WarrantyCase', {
  id: serial('id').primaryKey(),
  warrantyId: integer('warranty_id').notNull(),
  email: varchar('email', { length: 64 }).notNull(),
  description: text('description').notNull(),
  severity: varchar('severity', { length: 16 }).$type<WarrantyCaseSeverity>().default('modere'),
  status: varchar('status', { length: 16 }).$type<WarrantyCaseStatus>().default('ouvert'),
  estimatedCost: integer('estimated_cost'),
  actualCost: integer('actual_cost'),
  resolution: text('resolution'),
  customerResponse: text('customer_response'),
  openedAt: timestamp('opened_at').defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`;

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
      CREATE TABLE IF NOT EXISTS "WorkshopJob" (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER NOT NULL,
        email VARCHAR(64) NOT NULL,
        type VARCHAR(32) NOT NULL,
        description TEXT,
        supplier VARCHAR(128),
        estimated_cost INTEGER,
        actual_cost INTEGER,
        status VARCHAR(16) NOT NULL DEFAULT 'planifie',
        scheduled_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "WorkshopSupplier" (
        id SERIAL PRIMARY KEY,
        email VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        phone VARCHAR(32),
        contact_email VARCHAR(128),
        type VARCHAR(32),
        notes TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "Warranty" (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER NOT NULL,
        email VARCHAR(64) NOT NULL,
        buyer_name VARCHAR(128),
        buyer_email VARCHAR(128),
        buyer_phone VARCHAR(32),
        buyer_type VARCHAR(16) DEFAULT 'particulier',
        warranty_type VARCHAR(16) DEFAULT 'legale',
        sold_price INTEGER,
        sold_at TIMESTAMP NOT NULL DEFAULT NOW(),
        legal_expires_at TIMESTAMP NOT NULL DEFAULT NOW(),
        contract_expires_at TIMESTAMP,
        notes TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "WarrantyCase" (
        id SERIAL PRIMARY KEY,
        warranty_id INTEGER NOT NULL,
        email VARCHAR(64) NOT NULL,
        description TEXT NOT NULL,
        severity VARCHAR(16) DEFAULT 'modere',
        status VARCHAR(16) DEFAULT 'ouvert',
        estimated_cost INTEGER,
        actual_cost INTEGER,
        resolution TEXT,
        customer_response TEXT,
        opened_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
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

// ============================================================
// WORKSHOP JOBS
// ============================================================

export type WorkshopJobRecord = typeof workshopJob.$inferSelect;

export type NewWorkshopJob = {
  vehicleId: number;
  type: WorkshopJobType;
  description?: string | null;
  supplier?: string | null;
  estimatedCost?: number | null;
  scheduledAt?: Date | null;
};

export async function createWorkshopJob(email: string, data: NewWorkshopJob): Promise<WorkshopJobRecord[]> {
  await ensureSchema();
  return await getDb().insert(workshopJob).values({
    vehicleId: data.vehicleId,
    email,
    type: data.type,
    description: data.description ?? null,
    supplier: data.supplier ?? null,
    estimatedCost: data.estimatedCost ?? null,
    actualCost: null,
    status: 'planifie',
    scheduledAt: data.scheduledAt ?? null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();
}

export async function getWorkshopJobsByVehicle(vehicleId: number, email: string): Promise<WorkshopJobRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(workshopJob)
    .where(and(eq(workshopJob.vehicleId, vehicleId), eq(workshopJob.email, email)))
    .orderBy(desc(workshopJob.createdAt));
}

export async function getOpenWorkshopJobs(email: string): Promise<WorkshopJobRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(workshopJob)
    .where(and(
      eq(workshopJob.email, email),
      notInArray(workshopJob.status, ['termine', 'annule']),
    ))
    .orderBy(desc(workshopJob.createdAt))
    .limit(200);
}

export async function updateWorkshopJob(
  id: number,
  email: string,
  update: Partial<{
    status: WorkshopJobStatus;
    actualCost: number | null;
    completedAt: Date | null;
    supplier: string | null;
    estimatedCost: number | null;
    scheduledAt: Date | null;
    description: string | null;
  }>,
): Promise<WorkshopJobRecord[]> {
  await ensureSchema();
  return await getDb()
    .update(workshopJob)
    .set({ ...update, updatedAt: new Date() })
    .where(and(eq(workshopJob.id, id), eq(workshopJob.email, email)))
    .returning();
}

export async function deleteWorkshopJob(id: number, email: string): Promise<void> {
  await ensureSchema();
  await getDb()
    .delete(workshopJob)
    .where(and(eq(workshopJob.id, id), eq(workshopJob.email, email)));
}

// ============================================================
// WORKSHOP SUPPLIERS
// ============================================================

export type SupplierRecord = typeof workshopSupplier.$inferSelect;

export async function getSuppliers(email: string): Promise<SupplierRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(workshopSupplier)
    .where(eq(workshopSupplier.email, email))
    .orderBy(workshopSupplier.name);
}

export async function createSupplier(
  email: string,
  data: { name: string; phone?: string | null; contactEmail?: string | null; type?: SupplierType | null; notes?: string | null },
): Promise<SupplierRecord[]> {
  await ensureSchema();
  return await getDb().insert(workshopSupplier).values({
    email,
    name: data.name,
    phone: data.phone ?? null,
    contactEmail: data.contactEmail ?? null,
    type: data.type ?? null,
    notes: data.notes ?? null,
    active: true,
  }).returning();
}

// ============================================================
// WARRANTY
// ============================================================

export type WarrantyRecord = typeof warranty.$inferSelect;
export type WarrantyCaseRecord = typeof warrantyCase.$inferSelect;

export async function createWarranty(email: string, data: {
  vehicleId: number;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  buyerType: BuyerType;
  warrantyType: WarrantyType;
  soldPrice?: number | null;
  soldAt: Date;
  contractMonths?: number | null;
  legalDurationMonths?: 12 | 24 | null;  // particulier: 24 (défaut) ou 12 si clause réductive
  notes?: string | null;
}): Promise<WarrantyRecord[]> {
  await ensureSchema();
  // Véhicules d'occasion : 2 ans pour particuliers (réductible à 1 an par clause), 0 pour pros (pas de garantie légale)
  const legalMonths = data.buyerType === 'particulier' ? (data.legalDurationMonths ?? 24) : 0;
  const legalExpiresAt = new Date(data.soldAt);
  legalExpiresAt.setMonth(legalExpiresAt.getMonth() + legalMonths);
  let contractExpiresAt: Date | null = null;
  if (data.warrantyType === 'contractuelle' && data.contractMonths) {
    contractExpiresAt = new Date(data.soldAt);
    contractExpiresAt.setMonth(contractExpiresAt.getMonth() + data.contractMonths);
  }
  return await getDb().insert(warranty).values({
    vehicleId: data.vehicleId,
    email,
    buyerName: data.buyerName ?? null,
    buyerEmail: data.buyerEmail ?? null,
    buyerPhone: data.buyerPhone ?? null,
    buyerType: data.buyerType,
    warrantyType: data.warrantyType,
    soldPrice: data.soldPrice ?? null,
    soldAt: data.soldAt,
    legalExpiresAt,
    contractExpiresAt,
    notes: data.notes ?? null,
    active: true,
  }).returning();
}

export async function getWarranties(email: string, activeOnly = false): Promise<WarrantyRecord[]> {
  await ensureSchema();
  void activeOnly;
  return await getDb().select().from(warranty).where(eq(warranty.email, email))
    .orderBy(desc(warranty.soldAt)).limit(200);
}

export async function getWarranty(id: number, email: string): Promise<WarrantyRecord | null> {
  await ensureSchema();
  const rows = await getDb().select().from(warranty)
    .where(and(eq(warranty.id, id), eq(warranty.email, email))).limit(1);
  return rows[0] ?? null;
}

export async function createWarrantyCase(email: string, data: {
  warrantyId: number;
  description: string;
  severity?: WarrantyCaseSeverity;
  estimatedCost?: number | null;
}): Promise<WarrantyCaseRecord[]> {
  await ensureSchema();
  return await getDb().insert(warrantyCase).values({
    warrantyId: data.warrantyId,
    email,
    description: data.description,
    severity: data.severity ?? 'modere',
    status: 'ouvert',
    estimatedCost: data.estimatedCost ?? null,
    openedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();
}

export async function getWarrantyCases(warrantyId: number, email: string): Promise<WarrantyCaseRecord[]> {
  await ensureSchema();
  return await getDb().select().from(warrantyCase)
    .where(and(eq(warrantyCase.warrantyId, warrantyId), eq(warrantyCase.email, email)))
    .orderBy(desc(warrantyCase.createdAt));
}

export async function getOpenWarrantyCases(email: string): Promise<WarrantyCaseRecord[]> {
  await ensureSchema();
  return await getDb().select().from(warrantyCase)
    .where(and(eq(warrantyCase.email, email), notInArray(warrantyCase.status, ['resolu', 'rejete'])))
    .orderBy(desc(warrantyCase.createdAt))
    .limit(100);
}

export async function updateWarrantyCase(id: number, email: string, update: Partial<{
  status: WarrantyCaseStatus;
  severity: WarrantyCaseSeverity;
  estimatedCost: number | null;
  actualCost: number | null;
  resolution: string | null;
  customerResponse: string | null;
  resolvedAt: Date | null;
}>): Promise<WarrantyCaseRecord[]> {
  await ensureSchema();
  return await getDb().update(warrantyCase)
    .set({ ...update, updatedAt: new Date() })
    .where(and(eq(warrantyCase.id, id), eq(warrantyCase.email, email)))
    .returning();
}
