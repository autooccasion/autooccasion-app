// lib/attribution/index.ts
// Central entry point for the GP-CARS Attribution Engine.
// Import this in agents to register opportunities without coupling to DB internals.

import { createGaeOpportunite, updateGaeOpportunite, detectGaeDuplicate } from 'app/db';
import type { GaeOpportuniteType, GaeAgentSource, GaeStatus } from '@/lib/agents/shared-types';

export type { GaeOpportuniteType, GaeAgentSource, GaeStatus };

export interface GaeCreateInput {
  email: string;
  type: GaeOpportuniteType;
  agentSource: GaeAgentSource;
  title?: string;
  estimatedValue?: number;
  marginEstimated?: number;
  attributionConfidence?: number;
  vehicleId?: number;
  leadId?: number;
  mandatOpportuniteId?: number;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  listingUrl?: string;
}

// Non-blocking helper — wraps createGaeOpportunite in fire-and-forget.
// Safe to call from any agent without awaiting or catching errors.
export function trackOpportunite(input: GaeCreateInput): void {
  createGaeOpportunite(input).catch((err) => {
    console.error('[GAE] trackOpportunite failed:', err);
  });
}

// Awaitable version — use when you need the gaeId back.
export async function registerOpportunite(input: GaeCreateInput): Promise<string | null> {
  try {
    const rec = await createGaeOpportunite(input);
    return rec.gaeId;
  } catch (err) {
    console.error('[GAE] registerOpportunite failed:', err);
    return null;
  }
}

// Mark opportunity as transformed (sold, mandat signed, etc.)
export async function transformOpportunite(id: number, email: string, realValue?: number, humanActor?: string): Promise<void> {
  await updateGaeOpportunite(id, email, {
    status: 'transformee' as GaeStatus,
    realValue,
    transformedAt: new Date(),
  }, humanActor).catch((err) => {
    console.error('[GAE] transformOpportunite failed:', err);
  });
}

// Check for duplicate before creating
export async function checkDuplicate(email: string, make?: string, model?: string, year?: number, listingUrl?: string) {
  return detectGaeDuplicate(email, make ?? null, model ?? null, year ?? null, listingUrl).catch(() => null);
}
