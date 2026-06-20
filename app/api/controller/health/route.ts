import { NextResponse } from 'next/server';
import { CONTROLLER_CONTRACT } from '@/lib/agents/controller/contract';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    agent:   CONTROLLER_CONTRACT.name,
    version: CONTROLLER_CONTRACT.version,
    status:  'online',
    checks:  {},
    timestamp: new Date().toISOString(),
  });
}
