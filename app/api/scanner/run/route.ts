import { NextRequest, NextResponse } from 'next/server';
import { auth } from 'app/auth';
import { cookies } from 'next/headers';
import { scanAutoscout24 } from '@/lib/scanner/autoscout24';
import { runCarmeloAnalysis } from '@/lib/carmelo/analyze-core';
import { getVehicleByListingUrl } from 'app/db';
import { checkRateLimit } from '@/lib/rate-limit';

// Allow up to 60 s on Vercel Pro (3 analyses × ~12 s each + delays).
export const maxDuration = 60;

const MAX_ANALYSES_PER_RUN = 3;
const INTER_ANALYSIS_DELAY_MS = 2_000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const email = session.user.email;

  // 1 run per 5 minutes per user to avoid hammering AS24 and Claude.
  const rl = checkRateLimit(`scanner:${email}`, 1, 300_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Scanner déjà utilisé récemment. Attendez 5 minutes avant de relancer.' },
      { status: 429 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || cookies().get('gp_api_key')?.value;
  if (!apiKey) return NextResponse.json({ error: 'Clé API Anthropic non configurée.' }, { status: 500 });

  // 2. Scrape AutoScout24 search results.
  const scan = await scanAutoscout24(2);
  if (scan.error && scan.total === 0) {
    return NextResponse.json({ error: scan.error, found: 0, new: 0, analyzed: 0, results: [] }, { status: 503 });
  }

  // 3. Filter out URLs already in the database.
  const newUrls: string[] = [];
  for (const { url } of scan.listings) {
    const existing = await getVehicleByListingUrl(email, url);
    if (!existing) newUrls.push(url);
  }

  if (newUrls.length === 0) {
    return NextResponse.json({
      found: scan.total,
      new: 0,
      analyzed: 0,
      results: [],
      message: 'Aucun nouveau véhicule trouvé depuis le dernier scan.',
      scraperWarning: scan.error,
    });
  }

  // 4. Analyze up to MAX_ANALYSES_PER_RUN new listings.
  const toAnalyze = newUrls.slice(0, MAX_ANALYSES_PER_RUN);
  type ScanEntry = {
    url: string;
    ok: boolean;
    decision?: string;
    make?: string | null;
    vehicleId?: number;
    maxBuyPrice?: number | null;
    estimatedMargin?: number | null;
    confidence?: number | null;
    error?: string;
  };
  const results: ScanEntry[] = [];

  for (let i = 0; i < toAnalyze.length; i++) {
    const url = toAnalyze[i];
    const result = await runCarmeloAnalysis(email, url, apiKey);

    if (result.ok) {
      results.push({
        url,
        ok: true,
        decision: result.decision,
        make: result.make,
        vehicleId: result.vehicleId,
        maxBuyPrice: result.maxBuyPrice,
        estimatedMargin: result.estimatedMargin,
        confidence: result.confidence,
      });
    } else {
      results.push({ url, ok: false, error: result.error });
    }

    if (i < toAnalyze.length - 1) {
      await new Promise((r) => setTimeout(r, INTER_ANALYSIS_DELAY_MS));
    }
  }

  const analyzed = results.filter((r) => r.ok).length;

  return NextResponse.json({
    found: scan.total,
    new: newUrls.length,
    analyzed,
    results,
    message: `${analyzed} véhicule(s) analysé(s) sur ${newUrls.length} nouveau(x) trouvé(s).`,
    scraperWarning: scan.error,
  });
}
