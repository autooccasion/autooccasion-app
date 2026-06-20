import { NextResponse } from 'next/server';
import { SCANNER_CONTRACT } from '@/lib/agents/scanner/contract';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, boolean> = {};
  for (const dep of SCANNER_CONTRACT.externalDeps) {
    if (dep.required) checks[dep.envVar] = !!process.env[dep.envVar];
  }
  const allRequired = Object.values(checks).every(Boolean);

  return NextResponse.json({
    agent:   SCANNER_CONTRACT.name,
    version: SCANNER_CONTRACT.version,
    status:  allRequired ? 'online' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
}
