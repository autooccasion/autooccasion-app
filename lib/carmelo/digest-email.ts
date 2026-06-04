// Builds the HTML email for the daily GP-CARS digest.
// Pure function — no DB / network.

import type { VehicleRecord } from 'app/db';

function euro(n: number | null | undefined): string {
  return n == null ? '—' : `${n.toLocaleString('fr-BE')} €`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:4px 12px 4px 0;color:#a1a1aa;font-size:13px;white-space:nowrap">${label}</td>
    <td style="padding:4px 0;color:#f4f4f5;font-size:13px">${value}</td>
  </tr>`;
}

function vehicleCard(v: VehicleRecord, highlight: string): string {
  const label = [v.make, v.model, v.year].filter(Boolean).join(' ') || 'Véhicule';
  const link = v.listingUrl
    ? `<a href="${v.listingUrl}" style="color:#60a5fa;font-size:12px">Voir l'annonce ↗</a>`
    : '';
  return `<div style="background:#18181b;border:1px solid #3f3f46;border-radius:8px;padding:16px;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="color:#f4f4f5;font-weight:600;font-size:15px">${label}</span>
      <span style="font-size:12px;padding:2px 8px;border-radius:12px;background:#27272a;color:${highlight}">${v.decision ?? '—'}</span>
    </div>
    <table style="border-collapse:collapse;width:100%">
      ${row('Prix demandé', euro(v.askingPrice))}
      ${row('Achat max conseillé', euro(v.maxBuyPrice))}
      ${row('Marge estimée', euro(v.estimatedMargin))}
      ${row('Confiance', v.confidence != null ? `${v.confidence} %` : '—')}
      ${row('Rotation', v.rotationScore != null ? `${v.rotationScore}/10` : '—')}
    </table>
    ${link ? `<div style="margin-top:8px">${link}</div>` : ''}
  </div>`;
}

export type DigestData = {
  newOpportunities: VehicleRecord[];   // VERT/ORANGE in 'analyse'
  slowMovers: VehicleRecord[];         // 'publie' > 60 days
  inStock: number;
  published: number;
  soldLast30: number;
};

export function buildDigestEmail(data: DigestData, date = new Date()): string {
  const jour = new Intl.DateTimeFormat('fr-BE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);

  const decisionColor = (d: string | null) =>
    d === 'VERT' ? '#4ade80' : d === 'ORANGE' ? '#fb923c' : '#f87171';

  const opportunitiesSection = data.newOpportunities.length > 0
    ? `<h2 style="color:#f4f4f5;font-size:16px;margin:24px 0 12px">
        🟢 ${data.newOpportunities.length} nouvelle${data.newOpportunities.length > 1 ? 's opportunité' : ' opportunité'}${data.newOpportunities.length > 1 ? 's' : ''} à étudier
      </h2>
      ${data.newOpportunities.map((v) => vehicleCard(v, decisionColor(v.decision))).join('')}`
    : `<p style="color:#71717a;font-size:14px;margin:24px 0">Aucune nouvelle opportunité aujourd'hui.</p>`;

  const slowSection = data.slowMovers.length > 0
    ? `<h2 style="color:#f4f4f5;font-size:16px;margin:24px 0 12px">
        ⚠️ ${data.slowMovers.length} véhicule${data.slowMovers.length > 1 ? 's' : ''} en vitrine depuis plus de 60 jours
      </h2>
      ${data.slowMovers.map((v) => vehicleCard(v, '#fb923c')).join('')}`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">

    <div style="margin-bottom:24px">
      <h1 style="color:#f4f4f5;font-size:20px;font-weight:700;margin:0 0 4px">GP-CARS</h1>
      <p style="color:#71717a;font-size:13px;margin:0">Bilan du ${jour}</p>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">
      <div style="background:#18181b;border:1px solid #3f3f46;border-radius:8px;padding:12px;text-align:center">
        <p style="color:#71717a;font-size:11px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em">En stock</p>
        <p style="color:#f4f4f5;font-size:22px;font-weight:700;margin:0">${data.inStock}</p>
      </div>
      <div style="background:#18181b;border:1px solid #3f3f46;border-radius:8px;padding:12px;text-align:center">
        <p style="color:#71717a;font-size:11px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em">Publiés</p>
        <p style="color:#f4f4f5;font-size:22px;font-weight:700;margin:0">${data.published}</p>
      </div>
      <div style="background:#18181b;border:1px solid #3f3f46;border-radius:8px;padding:12px;text-align:center">
        <p style="color:#71717a;font-size:11px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em">Vendus (30 j)</p>
        <p style="color:#f4f4f5;font-size:22px;font-weight:700;margin:0">${data.soldLast30}</p>
      </div>
    </div>

    ${opportunitiesSection}
    ${slowSection}

    <div style="border-top:1px solid #27272a;margin-top:32px;padding-top:16px">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://autooccasion-app.vercel.app'}/gp/stock"
         style="display:inline-block;background:#fff;color:#000;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none">
        Ouvrir le stock →
      </a>
    </div>

    <p style="color:#3f3f46;font-size:11px;margin:24px 0 0">
      GP-CARS · Soumagne, Belgique · Envoi automatique quotidien
    </p>
  </div>
</body>
</html>`;
}
