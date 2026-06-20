import { NextResponse } from 'next/server';
import { MADORE_CONTRACT } from '@/lib/agents/madore/contract';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, boolean> = {};
  for (const dep of MADORE_CONTRACT.externalDeps) {
    if (dep.required) checks[dep.envVar] = !!process.env[dep.envVar];
  }
  const allRequired = Object.values(checks).every(Boolean);

  return NextResponse.json({
    agent:   MADORE_CONTRACT.name,
    version: MADORE_CONTRACT.version,
    status:  allRequired ? 'online' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
}
