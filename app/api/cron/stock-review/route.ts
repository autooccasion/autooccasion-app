// Daily stock health review — detects immobilized vehicles and fires alerts.
// Runs at 09:00 BE via Vercel Cron.

import { NextRequest, NextResponse } from 'next/server';
import { getVehicles, getActiveTenants } from 'app/db';
import { getVehiclesNeedingAction } from '@/lib/marketing/price-rules';
import { emit } from '@/lib/events/publish';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function runForTenant(email: string): Promise<{ tenant: string; actionsNeeded: number; checked: number }> {
    const vehicles = await getVehicles(email, 200);
    const actionsNeeded = getVehiclesNeedingAction(vehicles);

    if (actionsNeeded.length === 0) {
      return { tenant: email, actionsNeeded: 0, checked: vehicles.length };
    }

    // Fire individual events for each vehicle needing action
    for (const { vehicle, action } of actionsNeeded) {
      if (action.action === 'none') continue;
      const label = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ') || 'Véhicule';

      await emit('stock.immobilise', 'marketing', {
        vehicleId: vehicle.id,
        vehicleLabel: label,
        daysInStock: action.daysInStock,
        askingPrice: vehicle.askingPrice ?? undefined,
      });
    }

    // Send digest email with all vehicles needing action
    const rows = actionsNeeded.map(({ vehicle, action }) => {
      const label = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ') || 'Véhicule';
      const days = action.daysInStock;
      const badge =
        action.action === 'human_required' ? '🚨' :
        action.action === 'alert' ? '⚠️' :
        action.action === 'reduce' ? '📉' : '';
      const reason = action.reason;
      return `<tr style="border-bottom:1px solid #333">
        <td style="padding:8px 12px">${badge} ${label}</td>
        <td style="padding:8px 12px;text-align:center">${days}j</td>
        <td style="padding:8px 12px;color:#aaa;font-size:12px">${reason}</td>
        ${action.action === 'reduce' ? `<td style="padding:8px 12px;text-align:right;color:#fbbf24;font-weight:700">−${action.amount} €</td>` : '<td></td>'}
      </tr>`;
    }).join('');

    await sendEmail({
      to: email,
      subject: `📦 GP-CARS · Revue stock — ${actionsNeeded.length} véhicule(s) à traiter`,
      html: `
<div style="font-family:sans-serif;max-width:700px;margin:auto">
  <div style="background:#111;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:20px">📦 Revue du stock GP-CARS</h1>
    <p style="margin:4px 0 0;color:#aaa;font-size:13px">${actionsNeeded.length} véhicule(s) nécessitent une action</p>
  </div>
  <div style="background:#1a1a1a;padding:0;border-radius:0 0 12px 12px">
    <table style="width:100%;border-collapse:collapse;color:#eee">
      <thead>
        <tr style="background:#222">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#aaa;text-transform:uppercase">Véhicule</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#aaa;text-transform:uppercase">Jours</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#aaa;text-transform:uppercase">Recommandation</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#aaa;text-transform:uppercase">Action</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="padding:16px 24px">
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/gp/stock" style="display:inline-block;background:#fff;color:#000;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none">Gérer le stock →</a>
    </div>
  </div>
</div>`,
    });

    return { tenant: email, actionsNeeded: actionsNeeded.length, checked: vehicles.length };
}

export async function GET(req: NextRequest) {
  // Security: verify cron secret via Bearer header (consistent with other crons)
  const authHeader = req.headers.get('authorization');
  const secret = authHeader?.replace('Bearer ', '') ?? req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenants = await getActiveTenants();
  if (tenants.length === 0) return NextResponse.json({ error: 'Aucun garage actif.' }, { status: 500 });

  const results = [];
  for (const email of tenants) {
    try {
      results.push(await runForTenant(email));
    } catch (err) {
      console.error(`Cron stock-review [${email}]: échec`, err);
      results.push({ tenant: email, actionsNeeded: 0, checked: 0 });
    }
  }
  return NextResponse.json({ ok: true, tenants: tenants.length, results });
}
