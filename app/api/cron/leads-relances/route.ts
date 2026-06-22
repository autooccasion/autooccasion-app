// Cron daily 10:00 — alerts on ROUGE leads that haven't been contacted after 4h.
// MADORE qualifies a hot lead → commercial should call within 2h.
// This cron fires a reminder if still 'nouveau' after 4h.

import { NextRequest, NextResponse } from 'next/server';
import { getHotLeadsNotContacted } from 'app/db';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

const NOTIFY   = process.env.NOTIFY_EMAIL ?? '';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? '';
const HOURS_THRESHOLD = 4;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const secret = authHeader?.replace('Bearer ', '') ?? req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  if (!NOTIFY) return NextResponse.json({ error: 'NOTIFY_EMAIL non configuré.' }, { status: 500 });

  const leads = await getHotLeadsNotContacted(NOTIFY, HOURS_THRESHOLD).catch(() => []);
  if (leads.length === 0) {
    return NextResponse.json({ ok: true, message: 'Aucun lead ROUGE en attente.', checked: 0 });
  }

  const rows = leads.map(l => {
    const age = Math.round((Date.now() - new Date(l.createdAt!).getTime()) / 3600000);
    const phone = l.prospectPhone
      ? `<a href="tel:${l.prospectPhone}" style="color:#4ade80">${l.prospectPhone}</a>`
      : '<span style="color:#666">—</span>';
    return `
      <tr style="border-bottom:1px solid #333">
        <td style="padding:10px 12px;font-weight:600;color:#fca5a5">${l.prospectName ?? 'Prospect'}</td>
        <td style="padding:10px 12px">${phone}</td>
        <td style="padding:10px 12px;color:#aaa;font-size:12px">${l.vehicleSearch ?? '—'}</td>
        <td style="padding:10px 12px;color:#fbbf24;font-weight:700">${l.score ?? '?'}/100</td>
        <td style="padding:10px 12px;color:#f87171;font-weight:700">${age}h sans contact</td>
      </tr>`;
  }).join('');

  await sendEmail({
    to: NOTIFY,
    subject: `🔴 GP-CARS · ${leads.length} lead(s) ROUGE sans contact — Agir maintenant`,
    html: `
<div style="font-family:sans-serif;max-width:700px;margin:auto">
  <div style="background:#7f1d1d;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:20px">🔴 Leads ROUGE non contactés</h1>
    <p style="margin:4px 0 0;color:#fca5a5;font-size:13px">${leads.length} prospect(s) chauds en attente depuis plus de ${HOURS_THRESHOLD}h</p>
  </div>
  <div style="background:#1a1a1a;padding:0;border-radius:0 0 12px 12px">
    <table style="width:100%;border-collapse:collapse;color:#eee">
      <thead>
        <tr style="background:#222">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#aaa;text-transform:uppercase">Prospect</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#aaa;text-transform:uppercase">Téléphone</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#aaa;text-transform:uppercase">Recherche</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#aaa;text-transform:uppercase">Score</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#aaa;text-transform:uppercase">Délai</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="padding:16px 24px">
      <a href="${BASE_URL}/gp/leads" style="display:inline-block;background:#dc2626;color:#fff;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none">Gérer les leads →</a>
      <p style="margin-top:12px;color:#555;font-size:11px">Chaque heure sans contact réduit la probabilité de conversion d'environ 10%.</p>
    </div>
  </div>
</div>`,
  });

  return NextResponse.json({ ok: true, alerted: leads.length });
}
