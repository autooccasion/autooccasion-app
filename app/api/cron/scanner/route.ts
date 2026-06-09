import { NextRequest, NextResponse } from 'next/server';
import { scanAutoscout24 } from '@/lib/scanner/autoscout24';
import { runCarmeloAnalysis } from '@/lib/carmelo/analyze-core';
import { getVehicleByListingUrl } from 'app/db';

// Vercel Cron endpoint — called via GET with CRON_SECRET header.
// Mirrors the logic of POST /api/scanner/run but is designed for unattended
// daily execution (no session, uses server-side API key only).
export const maxDuration = 60;

const MAX_PER_RUN = 3;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? '';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Cron scanner: ANTHROPIC_API_KEY manquant.');
    return NextResponse.json({ error: 'Clé API manquante.' }, { status: 500 });
  }
  if (!NOTIFY_EMAIL) {
    console.error('Cron scanner: NOTIFY_EMAIL manquant.');
    return NextResponse.json({ error: 'NOTIFY_EMAIL manquant.' }, { status: 500 });
  }

  const scan = await scanAutoscout24(2);
  if (scan.error && scan.total === 0) {
    console.error('Cron scanner: échec scraping', scan.error);
    return NextResponse.json({ error: scan.error, found: 0 });
  }

  const newUrls: string[] = [];
  for (const { url } of scan.listings) {
    const existing = await getVehicleByListingUrl(NOTIFY_EMAIL, url);
    if (!existing) newUrls.push(url);
  }

  const toAnalyze = newUrls.slice(0, MAX_PER_RUN);
  let analyzed = 0;
  let opportunities = 0;

  for (let i = 0; i < toAnalyze.length; i++) {
    const result = await runCarmeloAnalysis(NOTIFY_EMAIL, toAnalyze[i], apiKey);
    if (result.ok) {
      analyzed++;
      if (result.decision === 'OR' || result.decision === 'VERT') opportunities++;
    }
    if (i < toAnalyze.length - 1) {
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }

  console.log(`Cron scanner: ${scan.total} trouvés, ${newUrls.length} nouveaux, ${analyzed} analysés, ${opportunities} opportunités.`);
  return NextResponse.json({ found: scan.total, new: newUrls.length, analyzed, opportunities });
}
