import { NextResponse } from 'next/server';
const start = Date.now();
export async function GET() {
  return NextResponse.json({
    service: 'gae',
    version: '1.0',
    status: 'ok',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - start,
  });
}
