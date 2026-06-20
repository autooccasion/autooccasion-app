import { NextResponse } from 'next/server';
import { GARANTIE_CONTRACT } from '@/lib/agents/garantie/contract';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  return NextResponse.json({
    agent:     GARANTIE_CONTRACT.name,
    version:   GARANTIE_CONTRACT.version,
    status:    hasApiKey ? 'online' : 'degraded',
    checks:    { ANTHROPIC_API_KEY: hasApiKey },
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - start,
  });
}
