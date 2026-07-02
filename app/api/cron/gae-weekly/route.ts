// Cron weekly Monday 06:00 — GAE performance report + stagnant opportunity alerts.
// Sends a comprehensive weekly report: ROI per agent, billing pipeline, stagnant opps.

import { NextRequest, NextResponse } from 'next/server';
import { getGaeStats, getGaeReport, getStagnantGaeOpportunites, getActiveTenants } from 'app/db';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? '';

const AGENT_LABELS: Record<string, string> = {
  carmelo:   'Carmelo',
  mandats:   'Mandats VO',
  madore:    'MADORE',
  garantie:  'Garantie',
  atelier:   'Atelier',
  marketing: 'Marketing',
  manuel:    'Manuel',
};

const TYPE_LABELS: Record<string, string> = {
  achat: 'Achat', mandat: 'Mandat', vente: 'Vente',
  garantie: 'Garantie', atelier: 'Atelier', lead: 'Lead',
  marketing: 'Marketing', financement: 'Financement',
};

async function runForTenant(email: string): Promise<{ tenant: string; sent: boolean; total: number }> {
  const [stats, report, stagnant] = await Promise.all([
    getGaeStats(email).catch(() => null),
    getGaeReport(email).catch(() => []),
    getStagnantGaeOpportunites(email, 14).catch(() => []),
  ]);

  if (!stats || stats.total === 0) return { tenant: email, sent: false, total: 0 };

  // Agent performance rows
  const agentRows = report.map(r => `
    <tr style="border-bottom:1px solid #333">
      <td style="padding:8px 12px;font-weight:600;color:#eee">${AGENT_LABELS[r.agent] ?? r.agent}</td>
      <td style="padding:8px 12px;text-align:center;color:#aaa">${r.total}</td>
      <td style="padding:8px 12px;text-align:center;color:#4ade80">${r.transformed}</td>
      <td style="padding:8px 12px;text-align:center;color:#60a5fa">${r.rate}%</td>
      <td style="padding:8px 12px;text-align:right;font-weight:700;color:#4ade80">${r.commissionEstimee.toLocaleString('fr-BE')} €</td>
      <td style="padding:8px 12px;text-align:center;color:#${r.avgConfidence >= 75 ? '4ade80' : r.avgConfidence >= 50 ? 'fbbf24' : 'f87171'}">${r.avgConfidence}%</td>
    </tr>`).join('');

  // Stagnant opportunity rows
  const stagnantRows = stagnant.slice(0, 10).map(o => {
    const days = Math.round((Date.now() - new Date(o.detectedAt!).getTime()) / 86400000);
    const label = [o.vehicleMake, o.vehicleModel, o.vehicleYear].filter(Boolean).join(' ') || o.title || '—';
    return `
    <tr style="border-bottom:1px solid #333">
      <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:#94a3b8">${o.gaeId}</td>
      <td style="padding:8px 12px;color:#eee">${label}</td>
      <td style="padding:8px 12px;color:#aaa">${TYPE_LABELS[o.type ?? ''] ?? o.type}</td>
      <td style="padding:8px 12px;text-align:center;color:#f87171;font-weight:700">${days}j</td>
    </tr>`;
  }).join('');

  const weekLabel = new Date().toLocaleDateString('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' });

  await sendEmail({
    to: email,
    subject: `📊 GP-CARS · Rapport GAE Hebdomadaire — ${weekLabel}`,
    html: `
<div style="font-family:sans-serif;max-width:700px;margin:auto">
  <div style="background:#111;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:20px">📊 Rapport GAE Hebdomadaire</h1>
    <p style="margin:4px 0 0;color:#aaa;font-size:13px">Attribution Engine — Lead Certifié IA · ${weekLabel}</p>
  </div>

  <div style="background:#1a1a1a;padding:20px 24px;border-radius:0 0 12px 12px;space-y:20px">

    <!-- KPIs globaux -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr>
        <td style="padding:12px;background:#222;border-radius:8px;text-align:center;width:25%">
          <p style="margin:0;font-size:24px;font-weight:700;color:#eee">${stats.total}</p>
          <p style="margin:4px 0 0;color:#666;font-size:11px">TOTAL OPP.</p>
        </td>
        <td style="padding:4px"></td>
        <td style="padding:12px;background:#14532d;border-radius:8px;text-align:center;width:25%">
          <p style="margin:0;font-size:24px;font-weight:700;color:#4ade80">${stats.transformedCount}</p>
          <p style="margin:4px 0 0;color:#86efac;font-size:11px">TRANSFORMÉES</p>
        </td>
        <td style="padding:4px"></td>
        <td style="padding:12px;background:#1e3a5f;border-radius:8px;text-align:center;width:25%">
          <p style="margin:0;font-size:24px;font-weight:700;color:#60a5fa">${stats.transformationRate}%</p>
          <p style="margin:4px 0 0;color:#93c5fd;font-size:11px">TAUX CONV.</p>
        </td>
        <td style="padding:4px"></td>
        <td style="padding:12px;background:#14532d;border-radius:8px;text-align:center;width:25%">
          <p style="margin:0;font-size:20px;font-weight:700;color:#4ade80">${(stats.commissionEstimee / 1000).toFixed(1)}k€</p>
          <p style="margin:4px 0 0;color:#86efac;font-size:11px">COMM. ESTIMÉE</p>
        </td>
      </tr>
    </table>

    ${stats.circumventionCount > 0 ? `
    <div style="background:#450a0a;border:1px solid #7f1d1d;border-radius:8px;padding:12px 16px;margin-bottom:20px">
      <p style="margin:0;color:#fca5a5;font-size:13px">⚠️ <strong>${stats.circumventionCount} tentative(s) de contournement</strong> détectée(s) — vérifier dans l'interface Attribution.</p>
    </div>` : ''}

    <!-- Performance par agent -->
    <h2 style="color:#eee;font-size:15px;margin:0 0 12px">Performance par agent</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead>
        <tr style="background:#222">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#666;text-transform:uppercase">Agent</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">Total</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">Conv.</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">Taux</th>
          <th style="padding:8px 12px;text-align:right;font-size:11px;color:#666;text-transform:uppercase">Commission</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">Confiance</th>
        </tr>
      </thead>
      <tbody style="color:#eee">${agentRows || '<tr><td colspan="6" style="padding:16px;text-align:center;color:#555">Aucune donnée</td></tr>'}</tbody>
    </table>

    ${stagnant.length > 0 ? `
    <!-- Opportunités stagnantes -->
    <h2 style="color:#fbbf24;font-size:15px;margin:0 0 12px">⏳ Opportunités stagnantes (&gt;14j sans progression)</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead>
        <tr style="background:#222">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#666;text-transform:uppercase">ID GAE</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#666;text-transform:uppercase">Véhicule</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#666;text-transform:uppercase">Type</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;color:#666;text-transform:uppercase">Âge</th>
        </tr>
      </thead>
      <tbody style="color:#eee">${stagnantRows}</tbody>
    </table>` : ''}

    <div style="margin-top:20px">
      <a href="${BASE_URL}/gp/attribution" style="display:inline-block;background:#fff;color:#000;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none;margin-right:8px">Voir Attribution →</a>
      <a href="${BASE_URL}/gp/leads" style="display:inline-block;background:#333;color:#fff;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none">Leads →</a>
    </div>

    <p style="margin-top:20px;color:#333;font-size:11px">Rapport automatique GP-CARS Attribution Engine · Lead Certifié IA</p>
  </div>
</div>`,
  });

  return { tenant: email, sent: true, total: stats.total };
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
      console.error(`Cron gae-weekly [${email}]: échec`, err);
      results.push({ tenant: email, sent: false, total: 0 });
    }
  }
  return NextResponse.json({ ok: true, tenants: tenants.length, results });
}
