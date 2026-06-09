import { NextRequest, NextResponse } from 'next/server';
import { scanAutoscout24 } from '@/lib/scanner/autoscout24';
import { runCarmeloAnalysis } from '@/lib/carmelo/analyze-core';
import { getVehicleByListingUrl, getVehicle } from 'app/db';
import { sendEmail } from '@/lib/email';

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
  const opportunityVehicleIds: number[] = [];

  for (let i = 0; i < toAnalyze.length; i++) {
    const result = await runCarmeloAnalysis(NOTIFY_EMAIL, toAnalyze[i], apiKey);
    if (result.ok) {
      analyzed++;
      if (result.decision === 'OR' || result.decision === 'VERT') {
        opportunityVehicleIds.push(result.vehicleId);
      }
    }
    if (i < toAnalyze.length - 1) {
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }

  const opportunities = opportunityVehicleIds.length;
  console.log(`Cron scanner: ${scan.total} trouvés, ${newUrls.length} nouveaux, ${analyzed} analysés, ${opportunities} opportunités.`);

  // Envoyer une alerte email immédiate si des opportunités ont été trouvées.
  if (opportunities > 0) {
    try {
      const vehicles = await Promise.all(
        opportunityVehicleIds.map((id) => getVehicle(id, NOTIFY_EMAIL)),
      );
      const lines = vehicles
        .filter(Boolean)
        .map((v) => {
          const label = [v!.make, v!.model, v!.year].filter(Boolean).join(' ') || 'Véhicule';
          const price = v!.maxBuyPrice != null ? `${v!.maxBuyPrice.toLocaleString('fr-BE')} €` : '—';
          const link = v!.listingUrl ? `<a href="${v!.listingUrl}" style="color:#60a5fa">Voir l'annonce ↗</a>` : '';
          return `<tr>
            <td style="padding:6px 12px 6px 0;color:#f4f4f5;font-size:14px">${label}</td>
            <td style="padding:6px 12px 6px 0;color:#4ade80;font-size:14px;font-weight:bold">${v!.decision ?? ''}</td>
            <td style="padding:6px 0;color:#f4f4f5;font-size:14px">Achat max : ${price}</td>
            <td style="padding:6px 0 6px 12px;font-size:13px">${link}</td>
          </tr>`;
        })
        .join('');

      const html = `<!DOCTYPE html><html><body style="background:#18181b;color:#f4f4f5;font-family:sans-serif;padding:24px">
        <h2 style="color:#f4f4f5;margin-bottom:4px">🔎 Scanner GP-CARS</h2>
        <p style="color:#a1a1aa;font-size:14px;margin-top:0">${opportunities} opportunité${opportunities > 1 ? 's' : ''} trouvée${opportunities > 1 ? 's' : ''} · ${new Date().toLocaleDateString('fr-BE')}</p>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-top:16px">
          <thead><tr>
            <th style="text-align:left;padding:4px 12px 8px 0;color:#a1a1aa;font-size:12px;text-transform:uppercase">Véhicule</th>
            <th style="text-align:left;padding:4px 12px 8px 0;color:#a1a1aa;font-size:12px;text-transform:uppercase">Décision</th>
            <th style="text-align:left;padding:4px 0 8px 0;color:#a1a1aa;font-size:12px;text-transform:uppercase">Prix</th>
            <th></th>
          </tr></thead>
          <tbody>${lines}</tbody>
        </table>
        <p style="margin-top:24px"><a href="${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://app.gp-cars.be'}/gp/stock" style="color:#60a5fa;font-size:13px">Voir le stock GP-CARS ↗</a></p>
      </body></html>`;

      await sendEmail({
        to: NOTIFY_EMAIL,
        subject: `🔎 GP-CARS · ${opportunities} opportunité${opportunities > 1 ? 's' : ''} détectée${opportunities > 1 ? 's' : ''}`,
        html,
      });
    } catch (err) {
      console.error('Cron scanner: échec envoi alerte email', err);
    }
  }

  return NextResponse.json({ found: scan.total, new: newUrls.length, analyzed, opportunities });
}
