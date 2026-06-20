import { NextResponse } from 'next/server';
import { CARMELO_CONTRACT } from '@/lib/agents/carmelo/contract';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, boolean> = {};

  // Check required env vars
  for (const dep of CARMELO_CONTRACT.externalDeps) {
    if (dep.required) {
      checks[dep.envVar] = !!process.env[dep.envVar];
    }
  }

  const allRequired = Object.values(checks).every(Boolean);

  return NextResponse.json({
    agent:   CARMELO_CONTRACT.name,
    version: CARMELO_CONTRACT.version,
    status:  allRequired ? 'online' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  }, { status: allRequired ? 200 : 200 }); // always 200 — status field carries the info
}
