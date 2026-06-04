import { drizzle } from 'drizzle-orm/postgres-js';
import { pgTable, serial, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { eq, desc } from 'drizzle-orm';
import postgres from 'postgres';
import { genSaltSync, hashSync } from 'bcrypt-ts';
import { extractDecision } from '@/lib/carmelo/decision';

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

// --- Carmelo analysis history ---

export type CarmeloAnalysisRecord = {
  id: number;
  email: string | null;
  vehicule: string | null;
  analyse: string | null;
  decision: string | null;
  createdAt: Date | null;
};

export async function saveAnalysis(
  email: string,
  vehicule: string,
  analyse: string,
) {
  const analyses = await ensureAnalysisTableExists();
  return await db.insert(analyses).values({
    email,
    vehicule,
    analyse,
    decision: extractDecision(analyse),
  });
}

export async function getAnalyses(email: string, limit = 50) {
  const analyses = await ensureAnalysisTableExists();
  return await db
    .select()
    .from(analyses)
    .where(eq(analyses.email, email))
    .orderBy(desc(analyses.createdAt))
    .limit(limit);
}

async function ensureAnalysisTableExists() {
  const result = await client`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'CarmeloAnalysis'
    );`;

  if (!result[0].exists) {
    await client`
      CREATE TABLE "CarmeloAnalysis" (
        id SERIAL PRIMARY KEY,
        email VARCHAR(64),
        vehicule TEXT,
        analyse TEXT,
        decision VARCHAR(16),
        created_at TIMESTAMP DEFAULT NOW()
      );`;
  }

  const table = pgTable('CarmeloAnalysis', {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 64 }),
    vehicule: text('vehicule'),
    analyse: text('analyse'),
    decision: varchar('decision', { length: 16 }),
    createdAt: timestamp('created_at'),
  });

  return table;
}
