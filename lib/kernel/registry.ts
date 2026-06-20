// Central registry of all GP-CARS agents.
// Add an agent here to make it visible to the orchestrator and system dashboard.

import { CARMELO_CONTRACT }    from '@/lib/agents/carmelo/contract';
import { MADORE_CONTRACT }     from '@/lib/agents/madore/contract';
import { MARKETING_CONTRACT }  from '@/lib/agents/marketing/contract';
import { CONTROLLER_CONTRACT } from '@/lib/agents/controller/contract';
import { SCANNER_CONTRACT }    from '@/lib/agents/scanner/contract';

export const AGENT_REGISTRY = [
  CARMELO_CONTRACT,
  MADORE_CONTRACT,
  MARKETING_CONTRACT,
  CONTROLLER_CONTRACT,
  SCANNER_CONTRACT,
] as const;

export type RegisteredAgent = typeof AGENT_REGISTRY[number];
export type AgentName = RegisteredAgent['name'];

// Returns a contract by agent name, or undefined if not found.
export function getAgentContract(name: string): RegisteredAgent | undefined {
  return AGENT_REGISTRY.find((a) => a.name === name);
}

// Returns all event types emitted across all agents — for validation.
export function getAllEmittedEvents(): string[] {
  return AGENT_REGISTRY.flatMap((a) => [...a.emits]);
}

// Returns all event types consumed across all agents.
export function getAllConsumedEvents(): string[] {
  return AGENT_REGISTRY.flatMap((a) => [...a.consumes]);
}

// Returns agents that consume a given event type.
export function getConsumersOf(eventType: string): RegisteredAgent[] {
  return AGENT_REGISTRY.filter((a) =>
    (a.consumes as readonly string[]).includes(eventType)
  );
}

// Returns agents that emit a given event type.
export function getEmittersOf(eventType: string): RegisteredAgent[] {
  return AGENT_REGISTRY.filter((a) =>
    (a.emits as readonly string[]).includes(eventType)
  );
}

// Validates registry integrity at startup:
// - No two agents emit the same event type
// - Every consumed event is emitted by at least one agent
export function validateRegistry(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for duplicate emitted events
  const emitted = getAllEmittedEvents();
  const seen = new Set<string>();
  for (const ev of emitted) {
    if (seen.has(ev)) {
      errors.push(`Événement dupliqué : "${ev}" émis par plusieurs agents.`);
    }
    seen.add(ev);
  }

  // Check that every consumed event has a producer
  const consumed = getAllConsumedEvents();
  for (const ev of consumed) {
    if (!seen.has(ev)) {
      errors.push(`Événement orphelin : "${ev}" consommé mais jamais émis.`);
    }
  }

  return { ok: errors.length === 0, errors };
}
