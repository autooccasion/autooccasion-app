import { NextResponse } from 'next/server';
import { MARKETING_CONTRACT } from '@/lib/agents/marketing/contract';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, boolean> = {};
  for (const dep of MARKETING_CONTRACT.externalDeps) {
    if (dep.required) checks[dep.envVar] = !!process.env[dep.envVar];
  }
  const allRequired = Object.values(checks).every(Boolean);

  return NextResponse.json({
    agent:   MARKETING_CONTRACT.name,
    version: MARKETING_CONTRACT.version,
    status:  allRequired ? 'online' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
}
