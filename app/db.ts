import { drizzle } from 'drizzle-orm/postgres-js';
import { pgTable, serial, varchar, text, timestamp, integer, boolean, json, jsonb } from 'drizzle-orm/pg-core';
import type { GaeOpportuniteType, GaeAgentSource, GaeStatus } from '@/lib/agents/shared-types';
import { eq, desc, and, inArray } from 'drizzle-orm';
import postgres from 'postgres';
import { genSaltSync, hashSync } from 'bcrypt-ts';
import { extractDecision } from '@/lib/carmelo/decision';
import { parseReport } from '@/lib/carmelo/parse';
import { PLANCHER_FRAIS } from '@/lib/carmelo/config';
import { mergeGarageConfig, type GarageConfig, type GarageConfigOverrides } from '@/lib/carmelo/garage-config';
import type {
  VehicleStatus, AgentDecision, ControllerFlag, VehicleSummary,
  AtelierInterventionStatus, AtelierInterventionType, PieceStatus, RdvType, RdvStatus,
  GarantieStatus, GarantieCategory, GarantieCoverage, GarantieDocumentType,
  MandatStatus, MandatPriorite, MandatUrgence, MandatRentabilite, ContactCanal, ContactResultat,
} from '@/lib/agents/shared-types';

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

// Configuration métier par garage (multi-tenant — tenant = email).
// `overrides` est un blob JSON partiel fusionné sur DEFAULT_GARAGE_CONFIG.
const garageConfig = pgTable('GarageConfig', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 64 }).notNull(),
  overrides: jsonb('overrides').$type<GarageConfigOverrides>(),
  updatedAt: timestamp('updated_at').defaultNow(),
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
  platformDrafts: json('platform_drafts').$type<{
    autoscout24?: { titre: string; description: string };
    '2ememain'?: { titre: string; description: string };
    leboncoin?: { titre: string; description: string };
  }>(),
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
  email:              varchar('email', { length: 64 }),
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
  email: varchar('email', { length: 64 }),
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
  email: varchar('email', { length: 64 }),
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

const atelierIntervention = pgTable('AtelierIntervention', {
  id:                  serial('id').primaryKey(),
  vehicleId:           integer('vehicle_id').notNull(),
  email:               varchar('email', { length: 64 }).notNull(),
  status:              varchar('status', { length: 16 }).$type<AtelierInterventionStatus>().default('planifie'),
  type:                varchar('type', { length: 32 }).$type<AtelierInterventionType>().default('preparation_vente'),
  description:         text('description'),
  mecanicNotes:        text('mecanic_notes'),
  estimatedCost:       integer('estimated_cost'),
  realCost:            integer('real_cost'),
  estimatedDuration:   integer('estimated_duration'),
  startDate:           timestamp('start_date'),
  endDate:             timestamp('end_date'),
  aiRecommendations:   text('ai_recommendations'),
  createdAt:           timestamp('created_at').defaultNow(),
  updatedAt:           timestamp('updated_at').defaultNow(),
});

export type AtelierInterventionRecord = typeof atelierIntervention.$inferSelect;

const pieceCommande = pgTable('PieceCommande', {
  id:               serial('id').primaryKey(),
  interventionId:   integer('intervention_id').notNull(),
  email:            varchar('email', { length: 64 }).notNull(),
  pieceName:        varchar('piece_name', { length: 128 }).notNull(),
  partNumber:       varchar('part_number', { length: 64 }),
  supplier:         varchar('supplier', { length: 64 }),
  estimatedPrice:   integer('estimated_price'),
  realPrice:        integer('real_price'),
  quantity:         integer('quantity').default(1),
  status:           varchar('status', { length: 16 }).$type<PieceStatus>().default('a_commander'),
  orderedAt:        timestamp('ordered_at'),
  receivedAt:       timestamp('received_at'),
  supplierMessage:  text('supplier_message'),
  createdAt:        timestamp('created_at').defaultNow(),
});

export type PieceCommandeRecord = typeof pieceCommande.$inferSelect;

const rdvAtelier = pgTable('RdvAtelier', {
  id:              serial('id').primaryKey(),
  email:           varchar('email', { length: 64 }).notNull(),
  vehicleId:       integer('vehicle_id'),
  leadId:          integer('lead_id'),
  interventionId:  integer('intervention_id'),
  customerName:    varchar('customer_name', { length: 128 }),
  customerPhone:   varchar('customer_phone', { length: 32 }),
  customerEmail:   varchar('customer_email', { length: 128 }),
  type:            varchar('type', { length: 32 }).$type<RdvType>().notNull(),
  status:          varchar('status', { length: 16 }).$type<RdvStatus>().default('planifie'),
  scheduledAt:     timestamp('scheduled_at').notNull(),
  durationMinutes: integer('duration_minutes').default(60),
  notes:           text('notes'),
  reminderSent:    boolean('reminder_sent').default(false),
  createdAt:       timestamp('created_at').defaultNow(),
  updatedAt:       timestamp('updated_at').defaultNow(),
});

export type RdvAtelierRecord = typeof rdvAtelier.$inferSelect;

const garantieDossier = pgTable('GarantieDossier', {
  id:                        serial('id').primaryKey(),
  email:                     varchar('email', { length: 64 }).notNull(),
  vehicleId:                 integer('vehicle_id'),
  vehicleMake:               varchar('vehicle_make', { length: 48 }),
  vehicleModel:              varchar('vehicle_model', { length: 64 }),
  vehicleYear:               integer('vehicle_year'),
  vehicleVin:                varchar('vehicle_vin', { length: 20 }),
  vehicleKmAtSale:           integer('vehicle_km_at_sale'),
  vehicleKmNow:              integer('vehicle_km_now'),
  saleDate:                  timestamp('sale_date'),
  invoiceNumber:             varchar('invoice_number', { length: 64 }),
  warrantyDurationMonths:    integer('warranty_duration_months').default(12),
  customerName:              varchar('customer_name', { length: 128 }),
  customerPhone:             varchar('customer_phone', { length: 32 }),
  customerEmail:             varchar('customer_email', { length: 128 }),
  claimDate:                 timestamp('claim_date').defaultNow(),
  claimDescription:          text('claim_description'),
  symptoms:                  text('symptoms'),
  diagnosis:                 text('diagnosis'),
  repairsAlreadyDone:        text('repairs_already_done'),
  usageType:                 varchar('usage_type', { length: 32 }),
  maintenanceOk:             boolean('maintenance_ok'),
  category:                  varchar('category', { length: 4 }).$type<GarantieCategory>(),
  coverageDecision:          varchar('coverage_decision', { length: 16 }).$type<GarantieCoverage>().default('en_attente'),
  coveragePercent:           integer('coverage_percent'),
  clientContribution:        integer('client_contribution'),
  estimatedCost:             integer('estimated_cost'),
  finalCost:                 integer('final_cost'),
  riskScoreLegal:            integer('risk_score_legal'),
  riskScoreFinancial:        integer('risk_score_financial'),
  litigationProbability:     integer('litigation_probability'),
  garageSuccessProbability:  integer('garage_success_probability'),
  confidenceLevel:           integer('confidence_level'),
  status:                    varchar('status', { length: 16 }).$type<GarantieStatus>().default('nouveau'),
  aiAnalysis:                text('ai_analysis'),
  aiRecommendation:          text('ai_recommendation'),
  aiStrengths:               json('ai_strengths').$type<string[]>(),
  aiWeaknesses:              json('ai_weaknesses').$type<string[]>(),
  aiLegalBasis:              json('ai_legal_basis').$type<string[]>(),
  aiNextSteps:               json('ai_next_steps').$type<string[]>(),
  communicationEmail:        text('communication_email'),
  communicationWhatsapp:     text('communication_whatsapp'),
  communicationRefus:        text('communication_refus'),
  communicationTransaction:  text('communication_transaction'),
  litigationPackage:         json('litigation_package').$type<Record<string, unknown>>(),
  internalNotes:             text('internal_notes'),
  createdAt:                 timestamp('created_at').defaultNow(),
  updatedAt:                 timestamp('updated_at').defaultNow(),
});

export type GarantieDossierRecord = typeof garantieDossier.$inferSelect;

const garantieDocument = pgTable('GarantieDocument', {
  id:          serial('id').primaryKey(),
  dossierId:   integer('dossier_id').notNull(),
  email:       varchar('email', { length: 64 }).notNull(),
  type:        varchar('type', { length: 32 }).$type<GarantieDocumentType>().notNull(),
  title:       varchar('title', { length: 128 }).notNull(),
  description: text('description'),
  fileUrl:     text('file_url'),
  addedBy:     varchar('added_by', { length: 16 }).default('garage'),
  notes:       text('notes'),
  createdAt:   timestamp('created_at').defaultNow(),
});

export type GarantieDocumentRecord = typeof garantieDocument.$inferSelect;

const garantiePiece = pgTable('GarantiePiece', {
  id:                      serial('id').primaryKey(),
  dossierId:               integer('dossier_id').notNull(),
  email:                   varchar('email', { length: 64 }).notNull(),
  pieceName:               varchar('piece_name', { length: 128 }).notNull(),
  pieceAgeMonths:          integer('piece_age_months'),
  pieceKm:                 integer('piece_km'),
  estimatedLifespanMonths: integer('estimated_lifespan_months'),
  estimatedLifespanKm:     integer('estimated_lifespan_km'),
  wearPercent:             integer('wear_percent'),
  coverageDecision:        varchar('coverage_decision', { length: 16 }).$type<GarantieCoverage>(),
  coveragePercent:         integer('coverage_percent'),
  estimatedCost:           integer('estimated_cost'),
  clientContribution:      integer('client_contribution'),
  justification:           text('justification'),
  createdAt:               timestamp('created_at').defaultNow(),
});

export type GarantiePieceRecord = typeof garantiePiece.$inferSelect;

const mandatOpportunite = pgTable('MandatOpportunite', {
  id:                  serial('id').primaryKey(),
  email:               varchar('email', { length: 64 }).notNull(),
  source:              varchar('source', { length: 32 }),
  listingUrl:          text('listing_url'),
  listingTitle:        text('listing_title'),
  listingDescription:  text('listing_description'),
  make:                varchar('make', { length: 48 }),
  model:               varchar('model', { length: 64 }),
  version:             varchar('version', { length: 128 }),
  year:                integer('year'),
  km:                  integer('km'),
  fuel:                varchar('fuel', { length: 32 }),
  gearbox:             varchar('gearbox', { length: 32 }),
  askingPrice:         integer('asking_price'),
  location:            varchar('location', { length: 128 }),
  sellerName:          varchar('seller_name', { length: 128 }),
  sellerPhone:         varchar('seller_phone', { length: 32 }),
  sellerEmail:         varchar('seller_email', { length: 128 }),
  sellerType:          varchar('seller_type', { length: 16 }),
  annonceQuality:      integer('annonce_quality'),
  photosQuality:       integer('photos_quality'),
  daysSincePosted:     integer('days_since_posted'),
  priceDropCount:      integer('price_drop_count').default(0),
  scoreMandat:         integer('score_mandat'),
  scoreSignature:      integer('score_signature'),
  scoreRentabilite:    integer('score_rentabilite'),
  priorite:            varchar('priorite', { length: 8 }).$type<MandatPriorite>(),
  urgenceNiveau:       varchar('urgence_niveau', { length: 16 }).$type<MandatUrgence>(),
  urgenceSignaux:      json('urgence_signaux').$type<string[]>(),
  prixRapide:          integer('prix_rapide'),
  prixMarche:          integer('prix_marche'),
  prixOptimise:        integer('prix_optimise'),
  delaiVente:          integer('delai_vente'),
  commissionBrute:     integer('commission_brute'),
  commissionNette:     integer('commission_nette'),
  rentabilite:         varchar('rentabilite', { length: 16 }).$type<MandatRentabilite>(),
  analyse:             text('analyse'),
  forces:              json('forces').$type<string[]>(),
  faiblesses:          json('faiblesses').$type<string[]>(),
  risques:             json('risques').$type<string[]>(),
  scriptSms:           text('script_sms'),
  scriptWhatsapp:      text('script_whatsapp'),
  scriptEmail:         text('script_email'),
  scriptMessenger:     text('script_messenger'),
  scriptTelephone:     json('script_telephone').$type<Record<string, string>>(),
  objections:          json('objections').$type<Array<{objection:string;reponse:string;strategie:string}>>(),
  relancesProgrammees: json('relances_programmees').$type<Array<{declencheur:string;canal:string;message:string}>>(),
  nextSteps:           json('next_steps').$type<string[]>(),
  status:              varchar('status', { length: 16 }).$type<MandatStatus>().default('nouveau'),
  internalNotes:       text('internal_notes'),
  rawAnalysis:         text('raw_analysis'),
  confidenceLevel:     integer('confidence_level'),
  proDeguise:          boolean('pro_deguise').default(false),
  createdAt:           timestamp('created_at').defaultNow(),
  updatedAt:           timestamp('updated_at').defaultNow(),
});

export type MandatOpportuniteRecord = typeof mandatOpportunite.$inferSelect;

const mandatContact = pgTable('MandatContact', {
  id:             serial('id').primaryKey(),
  opportuniteId:  integer('opportunite_id').notNull(),
  email:          varchar('email', { length: 64 }).notNull(),
  canal:          varchar('canal', { length: 16 }).$type<ContactCanal>().notNull(),
  messageEnvoye:  text('message_envoye'),
  reponseObtenue: text('reponse_obtenue'),
  resultat:       varchar('resultat', { length: 16 }).$type<ContactResultat>(),
  createdAt:      timestamp('created_at').defaultNow(),
});

export type MandatContactRecord = typeof mandatContact.$inferSelect;

const mandatRelance = pgTable('MandatRelance', {
  id:             serial('id').primaryKey(),
  opportuniteId:  integer('opportunite_id').notNull(),
  email:          varchar('email', { length: 64 }).notNull(),
  canal:          varchar('canal', { length: 16 }).$type<ContactCanal>().notNull(),
  messagePrevu:   text('message_prevu'),
  scheduledAt:    timestamp('scheduled_at').notNull(),
  sent:           boolean('sent').default(false),
  sentAt:         timestamp('sent_at'),
  triggerType:    varchar('trigger_type', { length: 32 }),
  createdAt:      timestamp('created_at').defaultNow(),
});

export type MandatRelanceRecord = typeof mandatRelance.$inferSelect;

const mandatMandat = pgTable('MandatMandat', {
  id:               serial('id').primaryKey(),
  opportuniteId:    integer('opportunite_id').notNull(),
  email:            varchar('email', { length: 64 }).notNull(),
  mandatNumber:     varchar('mandat_number', { length: 64 }),
  vehicleMake:      varchar('vehicle_make', { length: 48 }),
  vehicleModel:     varchar('vehicle_model', { length: 64 }),
  vehicleYear:      integer('vehicle_year'),
  vehicleKm:        integer('vehicle_km'),
  prixMandat:       integer('prix_mandat'),
  commissionPct:    integer('commission_pct'),
  durationDays:     integer('duration_days').default(60),
  signedAt:         timestamp('signed_at').defaultNow(),
  expiresAt:        timestamp('expires_at'),
  soldAt:           timestamp('sold_at'),
  soldPrice:        integer('sold_price'),
  commissionEarned: integer('commission_earned'),
  status:           varchar('status', { length: 16 }).default('actif'),
  notes:            text('notes'),
  createdAt:        timestamp('created_at').defaultNow(),
  updatedAt:        timestamp('updated_at').defaultNow(),
});

export type MandatMandatRecord = typeof mandatMandat.$inferSelect;

// ─── GAE TABLES ───────────────────────────────────────────────────────────────

export const gaeOpportunite = pgTable('GaeOpportunite', {
  id:                    serial('id').primaryKey(),
  gaeId:                 varchar('gae_id', { length: 32 }).unique().notNull(),
  email:                 varchar('email', { length: 64 }).notNull(),
  type:                  varchar('type', { length: 16 }).notNull(),
  agentSource:           varchar('agent_source', { length: 16 }).notNull(),
  status:                varchar('status', { length: 16 }).default('detectee'),
  title:                 varchar('title', { length: 256 }),
  attributionConfidence: integer('attribution_confidence').default(100),
  attributionNotes:      text('attribution_notes'),
  estimatedValue:        integer('estimated_value'),
  realValue:             integer('real_value'),
  marginEstimated:       integer('margin_estimated'),
  marginReal:            integer('margin_real'),
  commissionEstimated:   integer('commission_estimated'),
  commissionReal:        integer('commission_real'),
  vehicleId:             integer('vehicle_id'),
  leadId:                integer('lead_id'),
  mandatOpportuniteId:   integer('mandat_opportunite_id'),
  vehicleMake:           varchar('vehicle_make', { length: 48 }),
  vehicleModel:          varchar('vehicle_model', { length: 64 }),
  vehicleYear:           integer('vehicle_year'),
  listingUrl:            text('listing_url'),
  duplicateOf:           integer('duplicate_of'),
  isDuplicate:           boolean('is_duplicate').default(false),
  circumventionFlags:    jsonb('circumvention_flags'),
  billingRate:           integer('billing_rate'),
  billed:                boolean('billed').default(false),
  billedAt:              timestamp('billed_at'),
  billAmount:            integer('bill_amount'),
  detectedAt:            timestamp('detected_at').defaultNow(),
  contactedAt:           timestamp('contacted_at'),
  qualifiedAt:           timestamp('qualified_at'),
  transformedAt:         timestamp('transformed_at'),
  lostAt:                timestamp('lost_at'),
  createdAt:             timestamp('created_at').defaultNow(),
  updatedAt:             timestamp('updated_at').defaultNow(),
});

export const gaeEvent = pgTable('GaeEvent', {
  id:            serial('id').primaryKey(),
  opportuniteId: integer('opportunite_id').notNull(),
  email:         varchar('email', { length: 64 }).notNull(),
  eventType:     varchar('event_type', { length: 32 }).notNull(),
  oldValue:      text('old_value'),
  newValue:      text('new_value'),
  agentSource:   varchar('agent_source', { length: 16 }),
  humanActor:    varchar('human_actor', { length: 64 }),
  notes:         text('notes'),
  metadata:      jsonb('metadata'),
  createdAt:     timestamp('created_at').defaultNow(),
});

export type GaeOpportuniteRecord = typeof gaeOpportunite.$inferSelect;
export type GaeEventRecord = typeof gaeEvent.$inferSelect;

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
      CREATE TABLE IF NOT EXISTS "GarageConfig" (
        id SERIAL PRIMARY KEY,
        email VARCHAR(64) NOT NULL,
        overrides JSONB,
        updated_at TIMESTAMP DEFAULT NOW()
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
        platform_drafts JSONB,
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
      ALTER TABLE "Vehicle"
        ADD COLUMN IF NOT EXISTS platform_drafts JSONB`;

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
        email VARCHAR(64),
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
      ALTER TABLE "MadoreLead"
        ADD COLUMN IF NOT EXISTS email VARCHAR(64)`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "SystemEvent" (
        id SERIAL PRIMARY KEY,
        email VARCHAR(64),
        type VARCHAR(64) NOT NULL,
        source VARCHAR(32) NOT NULL,
        payload JSONB,
        processed BOOLEAN DEFAULT false,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      ALTER TABLE "SystemEvent"
        ADD COLUMN IF NOT EXISTS email VARCHAR(64)`;

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
        email VARCHAR(64),
        vehicle_type VARCHAR(64),
        fuel_preference VARCHAR(32),
        gearbox_preference VARCHAR(32),
        budget_min INTEGER,
        budget_max INTEGER,
        lead_id INTEGER,
        priority VARCHAR(16),
        created_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      ALTER TABLE "DemandSignal"
        ADD COLUMN IF NOT EXISTS email VARCHAR(64)`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "AtelierIntervention" (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER NOT NULL,
        email VARCHAR(64) NOT NULL,
        status VARCHAR(16) DEFAULT 'planifie',
        type VARCHAR(32) DEFAULT 'preparation_vente',
        description TEXT,
        mecanic_notes TEXT,
        estimated_cost INTEGER,
        real_cost INTEGER,
        estimated_duration INTEGER,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        ai_recommendations TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "PieceCommande" (
        id SERIAL PRIMARY KEY,
        intervention_id INTEGER NOT NULL,
        email VARCHAR(64) NOT NULL,
        piece_name VARCHAR(128) NOT NULL,
        part_number VARCHAR(64),
        supplier VARCHAR(64),
        estimated_price INTEGER,
        real_price INTEGER,
        quantity INTEGER DEFAULT 1,
        status VARCHAR(16) DEFAULT 'a_commander',
        ordered_at TIMESTAMP,
        received_at TIMESTAMP,
        supplier_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "RdvAtelier" (
        id SERIAL PRIMARY KEY,
        email VARCHAR(64) NOT NULL,
        vehicle_id INTEGER,
        lead_id INTEGER,
        intervention_id INTEGER,
        customer_name VARCHAR(128),
        customer_phone VARCHAR(32),
        customer_email VARCHAR(128),
        type VARCHAR(32) NOT NULL,
        status VARCHAR(16) DEFAULT 'planifie',
        scheduled_at TIMESTAMP NOT NULL,
        duration_minutes INTEGER DEFAULT 60,
        notes TEXT,
        reminder_sent BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "GarantieDossier" (
        id SERIAL PRIMARY KEY,
        email VARCHAR(64) NOT NULL,
        vehicle_id INTEGER,
        vehicle_make VARCHAR(48), vehicle_model VARCHAR(64), vehicle_year INTEGER, vehicle_vin VARCHAR(20),
        vehicle_km_at_sale INTEGER, vehicle_km_now INTEGER,
        sale_date TIMESTAMP,
        invoice_number VARCHAR(64),
        warranty_duration_months INTEGER DEFAULT 12,
        customer_name VARCHAR(128), customer_phone VARCHAR(32), customer_email VARCHAR(128),
        claim_date TIMESTAMP DEFAULT NOW(),
        claim_description TEXT, symptoms TEXT, diagnosis TEXT, repairs_already_done TEXT,
        usage_type VARCHAR(32), maintenance_ok BOOLEAN,
        category VARCHAR(4),
        coverage_decision VARCHAR(16) DEFAULT 'en_attente',
        coverage_percent INTEGER, client_contribution INTEGER,
        estimated_cost INTEGER, final_cost INTEGER,
        risk_score_legal INTEGER, risk_score_financial INTEGER,
        litigation_probability INTEGER, garage_success_probability INTEGER, confidence_level INTEGER,
        status VARCHAR(16) DEFAULT 'nouveau',
        ai_analysis TEXT, ai_recommendation TEXT,
        ai_strengths JSONB, ai_weaknesses JSONB, ai_legal_basis JSONB, ai_next_steps JSONB,
        communication_email TEXT, communication_whatsapp TEXT,
        communication_refus TEXT, communication_transaction TEXT,
        litigation_package JSONB,
        internal_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "GarantieDocument" (
        id SERIAL PRIMARY KEY,
        dossier_id INTEGER NOT NULL,
        email VARCHAR(64) NOT NULL,
        type VARCHAR(32) NOT NULL,
        title VARCHAR(128) NOT NULL,
        description TEXT,
        file_url TEXT,
        added_by VARCHAR(16) DEFAULT 'garage',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "GarantiePiece" (
        id SERIAL PRIMARY KEY,
        dossier_id INTEGER NOT NULL,
        email VARCHAR(64) NOT NULL,
        piece_name VARCHAR(128) NOT NULL,
        piece_age_months INTEGER, piece_km INTEGER,
        estimated_lifespan_months INTEGER, estimated_lifespan_km INTEGER,
        wear_percent INTEGER,
        coverage_decision VARCHAR(16),
        coverage_percent INTEGER, estimated_cost INTEGER, client_contribution INTEGER,
        justification TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "MandatOpportunite" (
        id SERIAL PRIMARY KEY,
        email VARCHAR(64) NOT NULL,
        source VARCHAR(32),
        listing_url TEXT,
        listing_title TEXT,
        listing_description TEXT,
        make VARCHAR(48), model VARCHAR(64), version VARCHAR(128),
        year INTEGER, km INTEGER, fuel VARCHAR(32), gearbox VARCHAR(32),
        asking_price INTEGER, location VARCHAR(128),
        seller_name VARCHAR(128), seller_phone VARCHAR(32), seller_email VARCHAR(128),
        seller_type VARCHAR(16),
        annonce_quality INTEGER, photos_quality INTEGER,
        days_since_posted INTEGER, price_drop_count INTEGER DEFAULT 0,
        score_mandat INTEGER, score_signature INTEGER, score_rentabilite INTEGER,
        priorite VARCHAR(8), urgence_niveau VARCHAR(16),
        urgence_signaux JSONB,
        prix_rapide INTEGER, prix_marche INTEGER, prix_optimise INTEGER,
        delai_vente INTEGER, commission_brute INTEGER, commission_nette INTEGER,
        rentabilite VARCHAR(16),
        analyse TEXT, forces JSONB, faiblesses JSONB, risques JSONB,
        script_sms TEXT, script_whatsapp TEXT, script_email TEXT, script_messenger TEXT,
        script_telephone JSONB, objections JSONB, relances_programmees JSONB, next_steps JSONB,
        status VARCHAR(16) DEFAULT 'nouveau',
        internal_notes TEXT, raw_analysis TEXT, confidence_level INTEGER,
        pro_deguise BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "MandatContact" (
        id SERIAL PRIMARY KEY,
        opportunite_id INTEGER NOT NULL,
        email VARCHAR(64) NOT NULL,
        canal VARCHAR(16) NOT NULL,
        message_envoye TEXT,
        reponse_obtenue TEXT,
        resultat VARCHAR(16),
        created_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "MandatRelance" (
        id SERIAL PRIMARY KEY,
        opportunite_id INTEGER NOT NULL,
        email VARCHAR(64) NOT NULL,
        canal VARCHAR(16) NOT NULL,
        message_prevu TEXT,
        scheduled_at TIMESTAMP NOT NULL,
        sent BOOLEAN DEFAULT false,
        sent_at TIMESTAMP,
        trigger_type VARCHAR(32),
        created_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "MandatMandat" (
        id SERIAL PRIMARY KEY,
        opportunite_id INTEGER NOT NULL,
        email VARCHAR(64) NOT NULL,
        mandat_number VARCHAR(64),
        vehicle_make VARCHAR(48), vehicle_model VARCHAR(64),
        vehicle_year INTEGER, vehicle_km INTEGER,
        prix_mandat INTEGER,
        commission_pct INTEGER,
        duration_days INTEGER DEFAULT 60,
        signed_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        sold_at TIMESTAMP,
        sold_price INTEGER,
        commission_earned INTEGER,
        status VARCHAR(16) DEFAULT 'actif',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "GaeOpportunite" (
        id SERIAL PRIMARY KEY,
        gae_id VARCHAR(32) UNIQUE NOT NULL,
        email VARCHAR(64) NOT NULL,
        type VARCHAR(16) NOT NULL,
        agent_source VARCHAR(16) NOT NULL,
        status VARCHAR(16) DEFAULT 'detectee',
        title VARCHAR(256),
        attribution_confidence INTEGER DEFAULT 100,
        attribution_notes TEXT,
        estimated_value INTEGER,
        real_value INTEGER,
        margin_estimated INTEGER,
        margin_real INTEGER,
        commission_estimated INTEGER,
        commission_real INTEGER,
        vehicle_id INTEGER,
        lead_id INTEGER,
        mandat_opportunite_id INTEGER,
        vehicle_make VARCHAR(48),
        vehicle_model VARCHAR(64),
        vehicle_year INTEGER,
        listing_url TEXT,
        duplicate_of INTEGER,
        is_duplicate BOOLEAN DEFAULT false,
        circumvention_flags JSONB,
        billing_rate INTEGER,
        billed BOOLEAN DEFAULT false,
        billed_at TIMESTAMP,
        bill_amount INTEGER,
        detected_at TIMESTAMP DEFAULT NOW(),
        contacted_at TIMESTAMP,
        qualified_at TIMESTAMP,
        transformed_at TIMESTAMP,
        lost_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`;

    await getClient()`
      CREATE TABLE IF NOT EXISTS "GaeEvent" (
        id SERIAL PRIMARY KEY,
        opportunite_id INTEGER NOT NULL,
        email VARCHAR(64) NOT NULL,
        event_type VARCHAR(32) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        agent_source VARCHAR(16),
        human_actor VARCHAR(64),
        notes TEXT,
        metadata JSONB,
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
// GARAGE CONFIG — configuration métier par tenant (email)
// ============================================================

/**
 * Liste des garages actifs (multi-tenant). Chaque tenant = un email qui scope ses données
 * et reçoit ses notifications. Inclut toujours NOTIFY_EMAIL (rétrocompat mono-tenant GP-CARS)
 * plus tous les comptes User. Ne lève jamais.
 */
export async function getActiveTenants(): Promise<string[]> {
  const set = new Set<string>();
  const notify = process.env.NOTIFY_EMAIL;
  if (notify) set.add(notify);
  try {
    await ensureSchema();
    const rows = await getDb().select({ email: users.email }).from(users);
    for (const r of rows) if (r.email) set.add(r.email);
  } catch (err) {
    console.error('getActiveTenants: fallback NOTIFY_EMAIL seul', err);
  }
  return Array.from(set);
}

/** Résout un tenant à partir d'un identifiant public (email de garage), validé contre la liste active. */
export async function resolveTenant(candidate: string | null | undefined): Promise<string | null> {
  if (!candidate) return null;
  const tenants = await getActiveTenants();
  return tenants.includes(candidate) ? candidate : null;
}

/**
 * Renvoie la configuration complète (défauts + overrides) pour un garage.
 * Un garage sans overrides reçoit DEFAULT_GARAGE_CONFIG (comportement actuel).
 * Ne lève jamais : en cas d'erreur DB, retombe sur les défauts.
 */
export async function getGarageConfig(email: string): Promise<GarageConfig> {
  try {
    await ensureSchema();
    const rows = await getDb()
      .select({ overrides: garageConfig.overrides })
      .from(garageConfig)
      .where(eq(garageConfig.email, email))
      .orderBy(desc(garageConfig.updatedAt))
      .limit(1);
    return mergeGarageConfig(rows[0]?.overrides ?? null);
  } catch (err) {
    console.error('getGarageConfig: fallback défauts', err);
    return mergeGarageConfig(null);
  }
}

/** Renvoie uniquement les overrides bruts d'un garage (pour pré-remplir l'écran settings). */
export async function getGarageConfigOverrides(email: string): Promise<GarageConfigOverrides | null> {
  await ensureSchema();
  const rows = await getDb()
    .select({ overrides: garageConfig.overrides })
    .from(garageConfig)
    .where(eq(garageConfig.email, email))
    .orderBy(desc(garageConfig.updatedAt))
    .limit(1);
  return rows[0]?.overrides ?? null;
}

/** Enregistre (upsert) les overrides de config d'un garage. */
export async function saveGarageConfig(email: string, overrides: GarageConfigOverrides): Promise<void> {
  await ensureSchema();
  const existing = await getDb()
    .select({ id: garageConfig.id })
    .from(garageConfig)
    .where(eq(garageConfig.email, email))
    .limit(1);
  if (existing[0]) {
    await getDb()
      .update(garageConfig)
      .set({ overrides, updatedAt: new Date() })
      .where(eq(garageConfig.id, existing[0].id));
  } else {
    await getDb().insert(garageConfig).values({ email, overrides, updatedAt: new Date() });
  }
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

export type ControllerJournalRow = {
  id: number;
  make: string | null;
  model: string | null;
  year: number | null;
  decision: string | null;
  status: string | null;
  controllerValidated: boolean | null;
  requiresHumanValidation: boolean | null;
  controllerFlags: ControllerFlag[] | null;
  updatedAt: Date | null;
};

// Projection légère pour le journal du Contrôleur (exclut les champs texte lourds).
export async function getControllerJournal(email: string, limit = 200): Promise<ControllerJournalRow[]> {
  await ensureSchema();
  const rows = await getDb()
    .select({
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      decision: vehicle.decision,
      status: vehicle.status,
      controllerValidated: vehicle.controllerValidated,
      requiresHumanValidation: vehicle.requiresHumanValidation,
      controllerFlags: vehicle.controllerFlags,
      updatedAt: vehicle.updatedAt,
    })
    .from(vehicle)
    .where(eq(vehicle.email, email))
    .orderBy(desc(vehicle.updatedAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    make: r.make ?? null,
    model: r.model ?? null,
    year: r.year ?? null,
    decision: r.decision ?? null,
    status: r.status ?? null,
    controllerValidated: r.controllerValidated ?? null,
    requiresHumanValidation: r.requiresHumanValidation ?? null,
    controllerFlags: (r.controllerFlags as ControllerFlag[] | null) ?? null,
    updatedAt: r.updatedAt ?? null,
  }));
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
  draft: {
    title: string;
    description: string;
    points: string[];
    tags: string[];
    platformDrafts?: {
      autoscout24?: { titre: string; description: string };
      '2ememain'?: { titre: string; description: string };
      leboncoin?: { titre: string; description: string };
    };
  },
) {
  await ensureSchema();
  return await getDb()
    .update(vehicle)
    .set({
      listingTitle: draft.title,
      listingDescription: draft.description,
      listingPoints: draft.points,
      listingTags: draft.tags,
      ...(draft.platformDrafts ? { platformDrafts: draft.platformDrafts } : {}),
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
  email?: string | null;
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

export async function saveLead(email: string, input: SaveLeadInput): Promise<MadoreLeadRecord[]> {
  await ensureSchema();
  return await getDb().insert(madoreLead).values({
    email,
    ...input,
    status: 'nouveau',
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();
}

export async function getLeads(email: string, limit = 100): Promise<MadoreLeadRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(madoreLead)
    .where(eq(madoreLead.email, email))
    .orderBy(desc(madoreLead.createdAt))
    .limit(limit);
}

export async function updateLeadStatus(id: number, email: string, status: string): Promise<void> {
  await ensureSchema();
  await getDb().update(madoreLead).set({ status, updatedAt: new Date() }).where(and(eq(madoreLead.id, id), eq(madoreLead.email, email)));
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
  email?: string,
): Promise<void> {
  await ensureSchema();
  await getDb().insert(systemEvent).values({ email: email ?? null, type, source, payload, processed: false });
}

export async function getPendingEvents(email?: string, limit = 50): Promise<SystemEventRecord[]> {
  await ensureSchema();
  const conditions = [eq(systemEvent.processed, false)];
  if (email) conditions.push(eq(systemEvent.email, email));
  return await getDb()
    .select()
    .from(systemEvent)
    .where(and(...conditions))
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

export async function getRecentEvents(email?: string, limit = 100): Promise<SystemEventRecord[]> {
  await ensureSchema();
  const query = getDb().select().from(systemEvent);
  if (email) {
    return await query.where(eq(systemEvent.email, email)).orderBy(desc(systemEvent.createdAt)).limit(limit);
  }
  return await query.orderBy(desc(systemEvent.createdAt)).limit(limit);
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

export async function saveDemandSignal(email: string, signal: {
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
    email,
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
export async function getRecentDemandSignals(email?: string, limit = 20): Promise<DemandSignalRecord[]> {
  await ensureSchema();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = email
    ? await getClient()`
        SELECT * FROM "DemandSignal"
        WHERE created_at >= ${since} AND email = ${email}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await getClient()`
        SELECT * FROM "DemandSignal"
        WHERE created_at >= ${since}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
  return rows as DemandSignalRecord[];
}

// Returns a formatted string summarizing demand for Carmelo's system prompt injection.
export async function buildDemandBlock(email?: string): Promise<string> {
  const signals = await getRecentDemandSignals(email, 30);
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

// ============================================================
// ATELIER — interventions mécanique
// ============================================================

export async function createAtelierIntervention(
  vehicleId: number,
  email: string,
  type: AtelierInterventionType = 'preparation_vente',
  description?: string | null,
  aiRecommendations?: string | null,
): Promise<AtelierInterventionRecord> {
  await ensureSchema();
  const rows = await getDb().insert(atelierIntervention).values({
    vehicleId,
    email,
    type,
    description: description ?? null,
    aiRecommendations: aiRecommendations ?? null,
    status: 'planifie',
  }).returning();
  return rows[0];
}

export async function getAtelierInterventions(email: string): Promise<AtelierInterventionRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(atelierIntervention)
    .where(eq(atelierIntervention.email, email))
    .orderBy(desc(atelierIntervention.createdAt));
}

// Interventions atelier pour un véhicule donné — utilisé par l'Agent Garantie
// pour décider sur la base du diagnostic technique réel du mécanicien.
export async function getAtelierInterventionsForVehicle(
  email: string,
  vehicleId: number,
): Promise<AtelierInterventionRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(atelierIntervention)
    .where(and(eq(atelierIntervention.email, email), eq(atelierIntervention.vehicleId, vehicleId)))
    .orderBy(desc(atelierIntervention.createdAt));
}

export async function getAtelierIntervention(id: number, email: string): Promise<AtelierInterventionRecord | null> {
  await ensureSchema();
  const rows = await getDb()
    .select()
    .from(atelierIntervention)
    .where(and(eq(atelierIntervention.id, id), eq(atelierIntervention.email, email)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateAtelierIntervention(
  id: number,
  email: string,
  updates: Partial<Omit<AtelierInterventionRecord, 'id' | 'email' | 'createdAt'>>,
): Promise<void> {
  await ensureSchema();
  await getDb()
    .update(atelierIntervention)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(atelierIntervention.id, id), eq(atelierIntervention.email, email)));
}

// ============================================================
// ATELIER — pièces à commander
// ============================================================

export async function addPieceCommande(
  interventionId: number,
  email: string,
  piece: {
    pieceName: string;
    partNumber?: string | null;
    supplier?: string | null;
    estimatedPrice?: number | null;
    quantity?: number | null;
    supplierMessage?: string | null;
  },
): Promise<PieceCommandeRecord> {
  await ensureSchema();
  const rows = await getDb().insert(pieceCommande).values({
    interventionId,
    email,
    pieceName: piece.pieceName,
    partNumber: piece.partNumber ?? null,
    supplier: piece.supplier ?? null,
    estimatedPrice: piece.estimatedPrice ?? null,
    quantity: piece.quantity ?? 1,
    supplierMessage: piece.supplierMessage ?? null,
    status: 'a_commander',
  }).returning();
  return rows[0];
}

export async function getPiecesForIntervention(interventionId: number): Promise<PieceCommandeRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(pieceCommande)
    .where(eq(pieceCommande.interventionId, interventionId))
    .orderBy(pieceCommande.createdAt);
}

export async function getPiecesToOrder(email: string): Promise<PieceCommandeRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(pieceCommande)
    .where(and(eq(pieceCommande.email, email), eq(pieceCommande.status, 'a_commander')))
    .orderBy(pieceCommande.createdAt);
}

export async function updatePieceStatus(id: number, email: string, status: PieceStatus): Promise<void> {
  await ensureSchema();
  const updates: Partial<typeof pieceCommande.$inferInsert> = { status };
  if (status === 'commande') updates.orderedAt = new Date();
  if (status === 'recu') updates.receivedAt = new Date();
  await getDb()
    .update(pieceCommande)
    .set(updates)
    .where(and(eq(pieceCommande.id, id), eq(pieceCommande.email, email)));
}

// ============================================================
// ATELIER — rendez-vous
// ============================================================

export async function createRdv(
  email: string,
  rdvData: {
    vehicleId?: number | null;
    leadId?: number | null;
    interventionId?: number | null;
    customerName?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    type: RdvType;
    scheduledAt: Date;
    durationMinutes?: number | null;
    notes?: string | null;
  },
): Promise<RdvAtelierRecord> {
  await ensureSchema();
  const rows = await getDb().insert(rdvAtelier).values({
    email,
    vehicleId: rdvData.vehicleId ?? null,
    leadId: rdvData.leadId ?? null,
    interventionId: rdvData.interventionId ?? null,
    customerName: rdvData.customerName ?? null,
    customerPhone: rdvData.customerPhone ?? null,
    customerEmail: rdvData.customerEmail ?? null,
    type: rdvData.type,
    scheduledAt: rdvData.scheduledAt,
    durationMinutes: rdvData.durationMinutes ?? 60,
    notes: rdvData.notes ?? null,
    status: 'planifie',
    reminderSent: false,
  }).returning();
  return rows[0];
}

export async function getUpcomingRdvs(email: string, days = 14): Promise<RdvAtelierRecord[]> {
  await ensureSchema();
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const rows = await getClient()`
    SELECT * FROM "RdvAtelier"
    WHERE email = ${email}
      AND status != 'annule'
      AND scheduled_at >= NOW()
      AND scheduled_at <= ${until}
    ORDER BY scheduled_at ASC
    LIMIT 50
  `;
  return rows as RdvAtelierRecord[];
}

export async function updateRdvStatus(id: number, email: string, status: RdvStatus): Promise<void> {
  await ensureSchema();
  await getDb()
    .update(rdvAtelier)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(rdvAtelier.id, id), eq(rdvAtelier.email, email)));
}

export async function getAtelierStats(email: string): Promise<{
  enCours: number;
  planifie: number;
  termine: number;
  facture: number;
  piecesACommander: number;
  rdvsThisWeek: number;
}> {
  await ensureSchema();
  const now = new Date();
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [interventions, pieces, rdvs] = await Promise.all([
    getAtelierInterventions(email),
    getPiecesToOrder(email),
    getClient()`
      SELECT COUNT(*) as count FROM "RdvAtelier"
      WHERE email = ${email}
        AND status != 'annule'
        AND scheduled_at >= ${now}
        AND scheduled_at <= ${weekEnd}
    `,
  ]);

  return {
    enCours:          interventions.filter(i => i.status === 'en_cours').length,
    planifie:         interventions.filter(i => i.status === 'planifie').length,
    termine:          interventions.filter(i => i.status === 'termine').length,
    facture:          interventions.filter(i => i.status === 'facture').length,
    piecesACommander: pieces.length,
    rdvsThisWeek:     Number((rdvs[0] as { count: string }).count),
  };
}

// ============================================================
// GARANTIE — dossiers SAV & litiges
// ============================================================

export async function createGarantieDossier(
  email: string,
  data: Partial<Omit<GarantieDossierRecord, 'id' | 'email' | 'createdAt' | 'updatedAt'>>,
): Promise<GarantieDossierRecord> {
  await ensureSchema();
  const rows = await getDb().insert(garantieDossier).values({
    email,
    vehicleId:              data.vehicleId              ?? null,
    vehicleMake:            data.vehicleMake            ?? null,
    vehicleModel:           data.vehicleModel           ?? null,
    vehicleYear:            data.vehicleYear            ?? null,
    vehicleVin:             data.vehicleVin             ?? null,
    vehicleKmAtSale:        data.vehicleKmAtSale        ?? null,
    vehicleKmNow:           data.vehicleKmNow           ?? null,
    saleDate:               data.saleDate               ?? null,
    invoiceNumber:          data.invoiceNumber          ?? null,
    warrantyDurationMonths: data.warrantyDurationMonths ?? 12,
    customerName:           data.customerName           ?? null,
    customerPhone:          data.customerPhone          ?? null,
    customerEmail:          data.customerEmail          ?? null,
    claimDate:              data.claimDate              ?? new Date(),
    claimDescription:       data.claimDescription       ?? null,
    symptoms:               data.symptoms               ?? null,
    diagnosis:              data.diagnosis              ?? null,
    repairsAlreadyDone:     data.repairsAlreadyDone     ?? null,
    usageType:              data.usageType              ?? null,
    maintenanceOk:          data.maintenanceOk          ?? null,
    coverageDecision:       'en_attente',
    status:                 'nouveau',
    internalNotes:          data.internalNotes          ?? null,
  }).returning();
  return rows[0];
}

export async function getGarantieDossiers(email: string): Promise<GarantieDossierRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(garantieDossier)
    .where(eq(garantieDossier.email, email))
    .orderBy(desc(garantieDossier.createdAt));
}

export async function getGarantieDossier(id: number, email: string): Promise<GarantieDossierRecord | null> {
  await ensureSchema();
  const rows = await getDb()
    .select()
    .from(garantieDossier)
    .where(and(eq(garantieDossier.id, id), eq(garantieDossier.email, email)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateGarantieDossier(
  id: number,
  email: string,
  updates: Partial<Omit<GarantieDossierRecord, 'id' | 'email' | 'createdAt'>>,
): Promise<void> {
  await ensureSchema();
  await getDb()
    .update(garantieDossier)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(garantieDossier.id, id), eq(garantieDossier.email, email)));
}

// ============================================================
// GARANTIE — documents archivés
// ============================================================

export async function addGarantieDocument(
  dossierId: number,
  email: string,
  doc: {
    type: GarantieDocumentType;
    title: string;
    description?: string | null;
    fileUrl?: string | null;
    addedBy?: string | null;
    notes?: string | null;
  },
): Promise<GarantieDocumentRecord> {
  await ensureSchema();
  const rows = await getDb().insert(garantieDocument).values({
    dossierId,
    email,
    type: doc.type,
    title: doc.title,
    description: doc.description ?? null,
    fileUrl: doc.fileUrl ?? null,
    addedBy: doc.addedBy ?? 'garage',
    notes: doc.notes ?? null,
  }).returning();
  return rows[0];
}

export async function getGarantieDocuments(dossierId: number): Promise<GarantieDocumentRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(garantieDocument)
    .where(eq(garantieDocument.dossierId, dossierId))
    .orderBy(garantieDocument.createdAt);
}

// ============================================================
// GARANTIE — pièces (vétusté)
// ============================================================

export async function saveGarantiePieces(
  dossierId: number,
  email: string,
  pieces: Array<{
    pieceName: string;
    pieceAgeMonths?: number | null;
    pieceKm?: number | null;
    estimatedLifespanMonths?: number | null;
    estimatedLifespanKm?: number | null;
    wearPercent?: number | null;
    coverageDecision?: GarantieCoverage | null;
    coveragePercent?: number | null;
    estimatedCost?: number | null;
    clientContribution?: number | null;
    justification?: string | null;
  }>,
): Promise<void> {
  await ensureSchema();
  if (pieces.length === 0) return;
  await getDb().insert(garantiePiece).values(
    pieces.map(p => ({
      dossierId,
      email,
      pieceName:               p.pieceName,
      pieceAgeMonths:          p.pieceAgeMonths          ?? null,
      pieceKm:                 p.pieceKm                 ?? null,
      estimatedLifespanMonths: p.estimatedLifespanMonths ?? null,
      estimatedLifespanKm:     p.estimatedLifespanKm     ?? null,
      wearPercent:             p.wearPercent             ?? null,
      coverageDecision:        p.coverageDecision        ?? null,
      coveragePercent:         p.coveragePercent         ?? null,
      estimatedCost:           p.estimatedCost           ?? null,
      clientContribution:      p.clientContribution      ?? null,
      justification:           p.justification           ?? null,
    }))
  );
}

export async function getGarantiePieces(dossierId: number): Promise<GarantiePieceRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(garantiePiece)
    .where(eq(garantiePiece.dossierId, dossierId))
    .orderBy(garantiePiece.createdAt);
}

// ============================================================
// GARANTIE — statistiques KPI
// ============================================================

export async function getGarantieStats(email: string): Promise<{
  total: number;
  actifs: number;
  litiges: number;
  resolus: number;
  coutTotal: number;
  coutMoyen: number;
  tauxPriseEnCharge: number;
}> {
  await ensureSchema();
  const dossiers = await getGarantieDossiers(email);
  const total    = dossiers.length;
  const actifs   = dossiers.filter(d => ['nouveau','en_analyse','decision_prise','sav_en_cours'].includes(d.status ?? '')).length;
  const litiges  = dossiers.filter(d => ['litige','expertise','procedure'].includes(d.status ?? '')).length;
  const resolus  = dossiers.filter(d => d.status === 'resolu').length;

  const avecCout = dossiers.filter(d => d.finalCost != null);
  const coutTotal = avecCout.reduce((sum, d) => sum + (d.finalCost ?? 0), 0);
  const coutMoyen = avecCout.length > 0 ? Math.round(coutTotal / avecCout.length) : 0;

  const prises = dossiers.filter(d => d.coverageDecision === 'totale' || d.coverageDecision === 'partielle').length;
  const decides = dossiers.filter(d => d.coverageDecision !== 'en_attente').length;
  const tauxPriseEnCharge = decides > 0 ? Math.round((prises / decides) * 100) : 0;

  return { total, actifs, litiges, resolus, coutTotal, coutMoyen, tauxPriseEnCharge };
}

// Fréquence des dossiers SAV / litiges par modèle — boucle Garantie → Achat.
// Permet à Carmelo d'être prudent à l'achat sur les modèles qui génèrent du SAV.
export type SavModelStat = { make: string; model: string; dossiers: number; litiges: number };

export async function getSavStatsByModel(email: string): Promise<SavModelStat[]> {
  await ensureSchema();
  const dossiers = await getGarantieDossiers(email);
  const byModel = new Map<string, SavModelStat>();
  for (const d of dossiers) {
    const make = (d.vehicleMake ?? '').trim();
    const model = (d.vehicleModel ?? '').trim();
    if (!make && !model) continue;
    const key = `${make.toLowerCase()}|${model.toLowerCase()}`;
    if (!byModel.has(key)) byModel.set(key, { make, model, dossiers: 0, litiges: 0 });
    const stat = byModel.get(key)!;
    stat.dossiers += 1;
    if (['litige', 'expertise', 'procedure'].includes(d.status ?? '')) stat.litiges += 1;
  }
  return Array.from(byModel.values()).sort((a, b) => b.dossiers - a.dossiers);
}

// ============================================================
// MANDATS — acquisition de mandats dépôt-vente
// ============================================================

export async function createMandatOpportunite(
  email: string,
  data: Partial<Omit<MandatOpportuniteRecord, 'id' | 'email' | 'createdAt' | 'updatedAt'>>,
): Promise<MandatOpportuniteRecord> {
  await ensureSchema();
  const rows = await getDb().insert(mandatOpportunite).values({
    email,
    source:             data.source             ?? null,
    listingUrl:         data.listingUrl         ?? null,
    listingTitle:       data.listingTitle       ?? null,
    listingDescription: data.listingDescription ?? null,
    make:               data.make               ?? null,
    model:              data.model              ?? null,
    version:            data.version            ?? null,
    year:               data.year               ?? null,
    km:                 data.km                 ?? null,
    fuel:               data.fuel               ?? null,
    gearbox:            data.gearbox            ?? null,
    askingPrice:        data.askingPrice        ?? null,
    location:           data.location           ?? null,
    sellerName:         data.sellerName         ?? null,
    sellerPhone:        data.sellerPhone        ?? null,
    sellerEmail:        data.sellerEmail        ?? null,
    sellerType:         data.sellerType         ?? null,
    status:             data.status             ?? 'nouveau',
    proDeguise:         data.proDeguise         ?? false,
  }).returning();
  return rows[0];
}

export async function getMandatOpportunites(email: string, status?: MandatStatus): Promise<MandatOpportuniteRecord[]> {
  await ensureSchema();
  if (status) {
    return await getDb()
      .select()
      .from(mandatOpportunite)
      .where(and(eq(mandatOpportunite.email, email), eq(mandatOpportunite.status, status)))
      .orderBy(desc(mandatOpportunite.createdAt));
  }
  return await getDb()
    .select()
    .from(mandatOpportunite)
    .where(eq(mandatOpportunite.email, email))
    .orderBy(desc(mandatOpportunite.createdAt));
}

export async function getMandatOpportunite(id: number, email: string): Promise<MandatOpportuniteRecord | null> {
  await ensureSchema();
  const rows = await getDb()
    .select()
    .from(mandatOpportunite)
    .where(and(eq(mandatOpportunite.id, id), eq(mandatOpportunite.email, email)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateMandatOpportunite(
  id: number,
  email: string,
  updates: Partial<Omit<MandatOpportuniteRecord, 'id' | 'email' | 'createdAt'>>,
): Promise<void> {
  await ensureSchema();
  await getDb()
    .update(mandatOpportunite)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(mandatOpportunite.id, id), eq(mandatOpportunite.email, email)));
}

export async function addMandatContact(
  opportuniteId: number,
  email: string,
  contact: { canal: ContactCanal; messageEnvoye?: string | null; reponseObtenue?: string | null; resultat?: ContactResultat | null },
): Promise<MandatContactRecord> {
  await ensureSchema();
  const rows = await getDb().insert(mandatContact).values({
    opportuniteId,
    email,
    canal:           contact.canal,
    messageEnvoye:   contact.messageEnvoye   ?? null,
    reponseObtenue:  contact.reponseObtenue  ?? null,
    resultat:        contact.resultat        ?? null,
  }).returning();
  return rows[0];
}

export async function getMandatContacts(opportuniteId: number): Promise<MandatContactRecord[]> {
  await ensureSchema();
  return await getDb()
    .select()
    .from(mandatContact)
    .where(eq(mandatContact.opportuniteId, opportuniteId))
    .orderBy(desc(mandatContact.createdAt));
}

export async function createMandatRelances(
  opportuniteId: number,
  email: string,
  relances: Array<{ canal: ContactCanal; messagePrevu: string; scheduledAt: Date; triggerType: string }>,
): Promise<void> {
  await ensureSchema();
  if (relances.length === 0) return;
  await getDb().insert(mandatRelance).values(
    relances.map(r => ({
      opportuniteId,
      email,
      canal:        r.canal,
      messagePrevu: r.messagePrevu,
      scheduledAt:  r.scheduledAt,
      triggerType:  r.triggerType,
      sent:         false,
    }))
  );
}

export async function getPendingRelances(email: string): Promise<MandatRelanceRecord[]> {
  await ensureSchema();
  const now = new Date();
  const rows = await getClient()`
    SELECT * FROM "MandatRelance"
    WHERE email = ${email}
      AND sent = false
      AND scheduled_at <= ${now}
    ORDER BY scheduled_at ASC
    LIMIT 50
  `;
  return rows as MandatRelanceRecord[];
}

export async function getUpcomingRelances(email: string, days = 14): Promise<MandatRelanceRecord[]> {
  await ensureSchema();
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const rows = await getClient()`
    SELECT * FROM "MandatRelance"
    WHERE email = ${email}
      AND sent = false
      AND scheduled_at <= ${until}
    ORDER BY scheduled_at ASC
    LIMIT 100
  `;
  return rows as MandatRelanceRecord[];
}

export async function createMandatMandat(
  email: string,
  data: Partial<Omit<MandatMandatRecord, 'id' | 'email' | 'createdAt' | 'updatedAt'>>,
): Promise<MandatMandatRecord> {
  await ensureSchema();
  const rows = await getDb().insert(mandatMandat).values({
    email,
    opportuniteId:   data.opportuniteId ?? 0,
    mandatNumber:    data.mandatNumber    ?? null,
    vehicleMake:     data.vehicleMake     ?? null,
    vehicleModel:    data.vehicleModel    ?? null,
    vehicleYear:     data.vehicleYear     ?? null,
    vehicleKm:       data.vehicleKm       ?? null,
    prixMandat:      data.prixMandat      ?? null,
    commissionPct:   data.commissionPct   ?? 5,
    durationDays:    data.durationDays    ?? 60,
    signedAt:        new Date(),
    expiresAt:       data.expiresAt       ?? null,
    status:          'actif',
    notes:           data.notes           ?? null,
  }).returning();
  return rows[0];
}

export async function getMandatStats(email: string): Promise<{
  total: number;
  nouveaux: number;
  contactes: number;
  rdv: number;
  mandatsSigmes: number;
  perdus: number;
  prioriteA: number;
  commissionEstimee: number;
  commissionRealisee: number;
  tauxConversion: number;
}> {
  await ensureSchema();
  const [opps, mandats] = await Promise.all([
    getMandatOpportunites(email),
    getDb().select().from(mandatMandat).where(eq(mandatMandat.email, email)),
  ]);

  const total         = opps.length;
  const nouveaux      = opps.filter(o => o.status === 'nouveau').length;
  const contactes     = opps.filter(o => o.status === 'contacte').length;
  const rdv           = opps.filter(o => o.status === 'rdv').length;
  const mandatsSigmes = opps.filter(o => o.status === 'mandat').length;
  const perdus        = opps.filter(o => o.status === 'perdu').length;
  const prioriteA     = opps.filter(o => o.priorite === 'A').length;

  const commissionEstimee  = opps.filter(o => o.commissionNette != null)
    .reduce((s, o) => s + (o.commissionNette ?? 0), 0);
  const commissionRealisee = mandats.filter(m => m.commissionEarned != null)
    .reduce((s, m) => s + (m.commissionEarned ?? 0), 0);

  const contactesTotal = contactes + rdv + mandatsSigmes + perdus;
  const tauxConversion = contactesTotal > 0 ? Math.round((mandatsSigmes / contactesTotal) * 100) : 0;

  return { total, nouveaux, contactes, rdv, mandatsSigmes, perdus, prioriteA, commissionEstimee, commissionRealisee, tauxConversion };
}

// ============================================================
// GAE — GP-CARS ATTRIBUTION ENGINE
// ============================================================

const GAE_PREFIXES: Record<string, string> = {
  achat:       'ACHAT',
  mandat:      'MANDAT',
  vente:       'VENTE',
  garantie:    'GAR',
  atelier:     'ATELIER',
  lead:        'LEAD',
  marketing:   'MKT',
  financement: 'FIN',
};

const GAE_BILLING_RATES: Record<string, number> = {
  achat:       100,
  mandat:       50,
  vente:        50,
  garantie:     30,
  atelier:      20,
  lead:         10,
  marketing:    50,
  financement:  75,
};

export interface CreateGaeInput {
  email: string;
  type: GaeOpportuniteType;
  agentSource: GaeAgentSource;
  title?: string | null;
  estimatedValue?: number | null;
  marginEstimated?: number | null;
  attributionConfidence?: number | null;
  attributionNotes?: string | null;
  vehicleId?: number | null;
  leadId?: number | null;
  mandatOpportuniteId?: number | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: number | null;
  listingUrl?: string | null;
}

export async function detectGaeDuplicate(
  email: string,
  make: string | null,
  model: string | null,
  year: number | null,
  listingUrl?: string | null,
): Promise<{ id: number; gaeId: string } | null> {
  await ensureSchema();
  // Check by listing URL first (exact match)
  if (listingUrl) {
    const byUrl = await getDb()
      .select({ id: gaeOpportunite.id, gaeId: gaeOpportunite.gaeId })
      .from(gaeOpportunite)
      .where(and(eq(gaeOpportunite.email, email), eq(gaeOpportunite.listingUrl, listingUrl)))
      .limit(1);
    if (byUrl.length > 0) return byUrl[0];
  }
  // Check by make/model/year within 60 days
  if (make && model) {
    const since = new Date(Date.now() - 60 * 86400000);
    const conditions = [
      eq(gaeOpportunite.email, email),
      eq(gaeOpportunite.vehicleMake, make),
      eq(gaeOpportunite.vehicleModel, model),
    ];
    if (year) conditions.push(eq(gaeOpportunite.vehicleYear, year));
    const byVehicle = await getDb()
      .select({ id: gaeOpportunite.id, gaeId: gaeOpportunite.gaeId })
      .from(gaeOpportunite)
      .where(and(...conditions))
      .orderBy(desc(gaeOpportunite.createdAt))
      .limit(1);
    if (byVehicle.length > 0 && byVehicle[0].id) {
      // Check it's recent
      const rec = await getDb().select().from(gaeOpportunite).where(eq(gaeOpportunite.id, byVehicle[0].id)).limit(1);
      if (rec[0] && new Date(rec[0].createdAt!) > since) return byVehicle[0];
    }
  }
  return null;
}

export async function createGaeOpportunite(input: CreateGaeInput): Promise<GaeOpportuniteRecord> {
  await ensureSchema();

  // Circumvention check
  const flags: string[] = [];
  if (!input.vehicleId && !input.leadId && !input.mandatOpportuniteId) {
    flags.push('no_linked_entity');
  }

  const billingRate = GAE_BILLING_RATES[input.type] ?? 0;
  const commissionEstimated = billingRate;

  // Insert with a placeholder gaeId, then update with real ID
  const rows = await getDb().insert(gaeOpportunite).values({
    gaeId:                 'PENDING',
    email:                 input.email,
    type:                  input.type,
    agentSource:           input.agentSource,
    title:                 input.title ?? null,
    attributionConfidence: input.attributionConfidence ?? 100,
    attributionNotes:      input.attributionNotes ?? null,
    estimatedValue:        input.estimatedValue ?? null,
    marginEstimated:       input.marginEstimated ?? null,
    commissionEstimated,
    vehicleId:             input.vehicleId ?? null,
    leadId:                input.leadId ?? null,
    mandatOpportuniteId:   input.mandatOpportuniteId ?? null,
    vehicleMake:           input.vehicleMake ?? null,
    vehicleModel:          input.vehicleModel ?? null,
    vehicleYear:           input.vehicleYear ?? null,
    listingUrl:            input.listingUrl ?? null,
    isDuplicate:           false,
    circumventionFlags:    flags.length > 0 ? flags : null,
    billingRate,
  }).returning();

  const record = rows[0];
  const year = new Date().getFullYear();
  const prefix = GAE_PREFIXES[input.type] ?? 'OPP';
  const gaeId = `${prefix}-${year}-${String(record.id).padStart(6, '0')}`;

  await getDb().update(gaeOpportunite).set({ gaeId }).where(eq(gaeOpportunite.id, record.id));

  // Log creation event
  await getDb().insert(gaeEvent).values({
    opportuniteId: record.id,
    email:         input.email,
    eventType:     'detectee',
    newValue:      gaeId,
    agentSource:   input.agentSource,
    notes:         `Opportunité créée par ${input.agentSource}`,
    metadata:      { type: input.type, title: input.title },
  });

  return { ...record, gaeId };
}

export async function updateGaeOpportunite(
  id: number,
  email: string,
  update: Partial<{
    status: GaeStatus;
    realValue: number;
    marginReal: number;
    commissionReal: number;
    attributionConfidence: number;
    billed: boolean;
    billedAt: Date;
    billAmount: number;
    contactedAt: Date;
    qualifiedAt: Date;
    transformedAt: Date;
    lostAt: Date;
  }>,
  humanActor?: string,
): Promise<void> {
  await ensureSchema();
  const old = await getDb().select().from(gaeOpportunite).where(and(eq(gaeOpportunite.id, id), eq(gaeOpportunite.email, email))).limit(1);
  if (!old[0]) return;

  await getDb().update(gaeOpportunite).set({ ...update, updatedAt: new Date() }).where(and(eq(gaeOpportunite.id, id), eq(gaeOpportunite.email, email)));

  if (update.status && update.status !== old[0].status) {
    await getDb().insert(gaeEvent).values({
      opportuniteId: id,
      email,
      eventType:  'status_change',
      oldValue:   old[0].status ?? null,
      newValue:   update.status,
      humanActor: humanActor ?? null,
    });
  }
}

export async function getGaeOpportunites(email: string, type?: GaeOpportuniteType, status?: GaeStatus, limit = 100): Promise<GaeOpportuniteRecord[]> {
  await ensureSchema();
  const conditions = [eq(gaeOpportunite.email, email)];
  if (type)   conditions.push(eq(gaeOpportunite.type, type));
  if (status) conditions.push(eq(gaeOpportunite.status, status));
  return await getDb().select().from(gaeOpportunite).where(and(...conditions)).orderBy(desc(gaeOpportunite.createdAt)).limit(limit);
}

export async function getGaeOpportunite(id: number, email: string): Promise<GaeOpportuniteRecord | null> {
  await ensureSchema();
  const rows = await getDb().select().from(gaeOpportunite).where(and(eq(gaeOpportunite.id, id), eq(gaeOpportunite.email, email))).limit(1);
  return rows[0] ?? null;
}

export async function getGaeHistory(opportuniteId: number, email: string): Promise<GaeEventRecord[]> {
  await ensureSchema();
  return await getDb().select().from(gaeEvent).where(and(eq(gaeEvent.opportuniteId, opportuniteId), eq(gaeEvent.email, email))).orderBy(desc(gaeEvent.createdAt));
}

export async function getGaeStats(email: string): Promise<{
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byAgent: Record<string, number>;
  transformedCount: number;
  transformationRate: number;
  commissionEstimee: number;
  commissionRealisee: number;
  circumventionCount: number;
  duplicateCount: number;
  highConfidenceCount: number;
}> {
  await ensureSchema();
  const all = await getDb().select().from(gaeOpportunite).where(eq(gaeOpportunite.email, email));

  const byType: Record<string, number>   = {};
  const byStatus: Record<string, number> = {};
  const byAgent: Record<string, number>  = {};
  let transformedCount = 0;
  let commissionEstimee = 0;
  let commissionRealisee = 0;
  let circumventionCount = 0;
  let duplicateCount = 0;
  let highConfidenceCount = 0;

  for (const o of all) {
    byType[o.type ?? ''] = (byType[o.type ?? ''] ?? 0) + 1;
    byStatus[o.status ?? ''] = (byStatus[o.status ?? ''] ?? 0) + 1;
    byAgent[o.agentSource ?? ''] = (byAgent[o.agentSource ?? ''] ?? 0) + 1;
    if (o.status === 'transformee') transformedCount++;
    commissionEstimee += o.commissionEstimated ?? 0;
    commissionRealisee += o.commissionReal ?? 0;
    if (Array.isArray(o.circumventionFlags) && (o.circumventionFlags as string[]).length > 0) circumventionCount++;
    if (o.isDuplicate) duplicateCount++;
    if ((o.attributionConfidence ?? 0) >= 75) highConfidenceCount++;
  }

  const total = all.length;
  const transformationRate = total > 0 ? Math.round((transformedCount / total) * 100) : 0;

  return { total, byType, byStatus, byAgent, transformedCount, transformationRate, commissionEstimee, commissionRealisee, circumventionCount, duplicateCount, highConfidenceCount };
}

export async function getGaeReport(email: string): Promise<{
  agent: string;
  total: number;
  transformed: number;
  rate: number;
  commissionEstimee: number;
  commissionRealisee: number;
  avgConfidence: number;
}[]> {
  await ensureSchema();
  const all = await getDb().select().from(gaeOpportunite).where(eq(gaeOpportunite.email, email));

  const agents: Record<string, {
    total: number; transformed: number;
    commissionEstimee: number; commissionRealisee: number;
    confidenceSum: number;
  }> = {};

  for (const o of all) {
    const src = o.agentSource ?? 'unknown';
    if (!agents[src]) agents[src] = { total: 0, transformed: 0, commissionEstimee: 0, commissionRealisee: 0, confidenceSum: 0 };
    agents[src].total++;
    if (o.status === 'transformee') agents[src].transformed++;
    agents[src].commissionEstimee  += o.commissionEstimated ?? 0;
    agents[src].commissionRealisee += o.commissionReal ?? 0;
    agents[src].confidenceSum      += o.attributionConfidence ?? 0;
  }

  return Object.entries(agents).map(([agent, v]) => ({
    agent,
    total: v.total,
    transformed: v.transformed,
    rate: v.total > 0 ? Math.round((v.transformed / v.total) * 100) : 0,
    commissionEstimee: v.commissionEstimee,
    commissionRealisee: v.commissionRealisee,
    avgConfidence: v.total > 0 ? Math.round(v.confidenceSum / v.total) : 0,
  })).sort((a, b) => b.commissionEstimee - a.commissionEstimee);
}

// ============================================================
// CRON HELPERS
// ============================================================

// Returns MandatRelances due within the next 24 hours (not yet sent).
export async function getDueRelances(email: string): Promise<MandatRelanceRecord[]> {
  await ensureSchema();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600000);
  const rows = await getClient()`
    SELECT * FROM "MandatRelance"
    WHERE email = ${email}
      AND sent = false
      AND scheduled_at <= ${in24h}
    ORDER BY scheduled_at ASC
    LIMIT 50
  `;
  return rows as MandatRelanceRecord[];
}

export async function markRelanceSent(id: number): Promise<void> {
  await ensureSchema();
  await getDb().update(mandatRelance).set({ sent: true, sentAt: new Date() }).where(eq(mandatRelance.id, id));
}

// Returns ROUGE leads that are still 'nouveau' and were created more than `hoursThreshold` hours ago.
export async function getHotLeadsNotContacted(email: string, hoursThreshold = 4): Promise<MadoreLeadRecord[]> {
  await ensureSchema();
  const cutoff = new Date(Date.now() - hoursThreshold * 3600000);
  const rows = await getClient()`
    SELECT * FROM "MadoreLead"
    WHERE email = ${email}
      AND priority = 'ROUGE'
      AND status = 'nouveau'
      AND created_at <= ${cutoff}
    ORDER BY created_at ASC
    LIMIT 20
  `;
  return rows as MadoreLeadRecord[];
}

// Returns GAE opportunities stuck in early stages for more than `days` days.
export async function getStagnantGaeOpportunites(email: string, days = 14): Promise<GaeOpportuniteRecord[]> {
  await ensureSchema();
  const cutoff = new Date(Date.now() - days * 86400000);
  const rows = await getClient()`
    SELECT * FROM "GaeOpportunite"
    WHERE email = ${email}
      AND status IN ('detectee', 'contactee')
      AND detected_at <= ${cutoff}
    ORDER BY detected_at ASC
    LIMIT 50
  `;
  return rows as GaeOpportuniteRecord[];
}
