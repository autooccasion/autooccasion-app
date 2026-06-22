import { NextResponse } from 'next/server';
const start = Date.now();
export async function GET() {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  return NextResponse.json({
    agent: 'mandats',
    version: '1.0',
    status: hasKey ? 'ok' : 'degraded',
    checks: { anthropic_api_key: hasKey },
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - start,
  });
}
