// Cron daily 09:30 — sends due Mandats VO follow-up messages to sellers.
// The Mandats AI schedules relances (J+2, J+7, J+14) when analyzing a listing.
// This cron triggers any that are due in the next 24h.

import { NextRequest, NextResponse } from 'next/server';
import { getDueRelances, markRelanceSent, getMandatOpportunite, getActiveTenants } from 'app/db';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? '';

const CANAL_LABELS: Record<string, string> = {
  whatsapp:  'WhatsApp',
  sms:       'SMS',
  email:     'Email',
  telephone: 'Téléphone',
  messenger: 'Messenger',
};

async function runForTenant(email: string): Promise<{ tenant: string; sent: number }> {
  const relances = await getDueRelances(email).catch(() => []);
  if (relances.length === 0) {
    return { tenant: email, sent: 0 };
  }

  // Enrich with opportunite context
  const rows: string[] = [];
  for (const r of relances) {
    const opp = await getMandatOpportunite(r.opportuniteId, email).catch(() => null);
    const vehicleLabel = opp
      ? [opp.make, opp.model, opp.year].filter(Boolean).join(' ') || opp.listingTitle || `Opportunité #${opp.id}`
      : `Opportunité #${r.opportuniteId}`;

    const canal = CANAL_LABELS[r.canal] ?? r.canal;
    const message = r.messagePrevu ?? '(message non défini)';
    const scheduledLabel = new Date(r.scheduledAt).toLocaleDateString('fr-BE');

    rows.push(`
      <tr style="border-bottom:1px solid #333">
        <td style="padding:10px 12px;font-weight:600;color:#eee">${vehicleLabel}</td>
        <td style="padding:10px 12px;color:#60a5fa">${canal}</td>
        <td style="padding:10px 12px;color:#aaa;font-size:12px">${scheduledLabel}</td>
        <td style="padding:10px 12px;color:#ccc;font-size:12px;max-width:300px">${message.slice(0, 120)}…</td>
      </tr>`);

    await markRelanceSent(r.id).catch(() => {});
  }

  await sendEmail({
    to: email,
    subject: `📬 GP-CARS · ${relances.length} relance(s) Mandats à envoyer aujourd'hui`,
    html: `
<div style="font-family:sans-serif;max-width:700px;margin:auto">
  <div style="background:#1e3a5f;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:20px">📬 Relances Mandats VO</h1>
    <p style="margin:4px 0 0;color:#93c5fd;font-size:13px">${relances.length} message(s) à envoyer aujourd'hui aux vendeurs</p>
  </div>
  <div style="background:#1a1a1a;padding:0;border-radius:0 0 12px 12px">
    <table style="width:100%;border-collapse:collapse;color:#eee">
      <thead>
        <tr style="background:#222">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#aaa;text-transform:uppercase">Véhicule</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#aaa;text-transform:uppercase">Canal</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#aaa;text-transform:uppercase">Prévu le</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#aaa;text-transform:uppercase">Message</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>
    <div style="padding:16px 24px">
      <a href="${BASE_URL}/gp/mandats" style="display:inline-block;background:#2563eb;color:#fff;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none">Ouvrir les mandats →</a>
      <p style="margin-top:12px;color:#555;font-size:11px">Les messages sont à envoyer manuellement depuis l'interface Mandats VO.</p>
    </div>
  </div>
</div>`,
  });

  return { tenant: email, sent: relances.length };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const secret = authHeader?.replace('Bearer ', '') ?? req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const tenants = await getActiveTenants();
  if (tenants.length === 0) return NextResponse.json({ error: 'Aucun garage actif.' }, { status: 500 });

  const results = [];
  for (const email of tenants) {
    try {
      results.push(await runForTenant(email));
    } catch (err) {
      console.error(`Cron mandats-relances [${email}]: échec`, err);
      results.push({ tenant: email, sent: 0 });
    }
  }
  return NextResponse.json({ ok: true, tenants: tenants.length, results });
}
