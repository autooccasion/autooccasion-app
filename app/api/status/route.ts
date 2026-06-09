import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';

// Returns configuration status for all required env vars.
// Auth-protected — admin use only.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  function check(key: string, mask = true): { configured: boolean; value?: string } {
    const v = process.env[key];
    if (!v) return { configured: false };
    const display = mask ? `${v.slice(0, 4)}${'*'.repeat(Math.max(0, v.length - 8))}${v.slice(-4)}` : v;
    return { configured: true, value: display };
  }

  return NextResponse.json({
    anthropic:    { label: 'ANTHROPIC_API_KEY',   ...check('ANTHROPIC_API_KEY') },
    scraperapi:   { label: 'SCRAPERAPI_KEY',       ...check('SCRAPERAPI_KEY') },
    cron:         { label: 'CRON_SECRET',          ...check('CRON_SECRET') },
    notifyEmail:  { label: 'NOTIFY_EMAIL',         ...check('NOTIFY_EMAIL', false) },
    resend:       { label: 'RESEND_API_KEY',       ...check('RESEND_API_KEY') },
    resendFrom:   { label: 'RESEND_FROM_EMAIL',    ...check('RESEND_FROM_EMAIL', false) },
    postgres:     { label: 'POSTGRES_URL',         ...check('POSTGRES_URL') },
    baseUrl:      { label: 'NEXT_PUBLIC_BASE_URL', ...check('NEXT_PUBLIC_BASE_URL', false) },
  });
}
