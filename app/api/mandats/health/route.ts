import { NextResponse } from 'next/server';
import { MANDATS_CONTRACT } from '@/lib/agents/mandats/contract';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  return NextResponse.json({
    agent:     MANDATS_CONTRACT.name,
    version:   MANDATS_CONTRACT.version,
    status:    hasApiKey ? 'online' : 'degraded',
    checks:    { ANTHROPIC_API_KEY: hasApiKey },
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - start,
  });
}
