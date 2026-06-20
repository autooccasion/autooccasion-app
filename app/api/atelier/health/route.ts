import { NextResponse } from 'next/server';
import { ATELIER_CONTRACT } from '@/lib/agents/atelier/contract';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();

  return NextResponse.json({
    agent:     ATELIER_CONTRACT.name,
    version:   ATELIER_CONTRACT.version,
    status:    'online',
    checks:    {},
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - start,
  });
}
