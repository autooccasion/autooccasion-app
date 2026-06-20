// Runs daily at 07:00 — sends reminder emails for RDVs the next day.
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? '';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? new URL(req.url).searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  // We need a direct DB query since we don't have email per-session here
  // Import via postgres template tag
  const { default: postgres } = await import('postgres');
  const sql = postgres(`${process.env.POSTGRES_URL!}?sslmode=require`);

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const from = new Date(tomorrow);
    from.setHours(0, 0, 0, 0);
    const to = new Date(tomorrow);
    to.setHours(23, 59, 59, 999);

    const rdvs = await sql`
      SELECT r.*, v.make, v.model, v.year
      FROM "RdvAtelier" r
      LEFT JOIN "Vehicle" v ON v.id = r.vehicle_id
      WHERE r.status IN ('planifie', 'confirme')
        AND r.reminder_sent = false
        AND r.scheduled_at >= ${from}
        AND r.scheduled_at <= ${to}
      ORDER BY r.scheduled_at ASC
    `;

    const NOTIFY = process.env.NOTIFY_EMAIL ?? '';
    let sent = 0;

    for (const rdv of rdvs) {
      const scheduledAt = new Date(rdv.scheduled_at);
      const timeStr = scheduledAt.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
      const dateStr = scheduledAt.toLocaleDateString('fr-BE', { weekday: 'long', day: '2-digit', month: 'long' });
      const vehicleLabel = rdv.make ? `${rdv.make} ${rdv.model ?? ''} ${rdv.year ?? ''}`.trim() : null;

      const typeLabels: Record<string, string> = {
        diagnostic: 'Diagnostic', intervention: 'Intervention',
        livraison: 'Livraison', reprise_trade_in: 'Reprise', essai: 'Essai',
      };
      const typeLabel = typeLabels[rdv.type as string] ?? rdv.type;

      // Email to garage owner (always)
      if (NOTIFY) {
        await sendEmail({
          to: NOTIFY,
          subject: `📅 GP-CARS · RDV demain ${timeStr} — ${rdv.customer_name ?? 'Client'} · ${typeLabel}`,
          html: buildRdvReminderGarageEmail({ rdv, typeLabel, dateStr, timeStr, vehicleLabel, baseUrl: BASE_URL }),
        }).catch(() => null);
        sent++;
      }

      // Email to customer if they have one
      if (rdv.customer_email) {
        await sendEmail({
          to: rdv.customer_email as string,
          subject: `Rappel de votre rendez-vous GP-CARS — ${dateStr} à ${timeStr}`,
          html: buildRdvReminderClientEmail({ rdv, typeLabel, dateStr, timeStr, vehicleLabel }),
        }).catch(() => null);
      }

      // Mark as sent
      await sql`
        UPDATE "RdvAtelier" SET reminder_sent = true WHERE id = ${rdv.id}
      `;
    }

    await sql.end();
    return NextResponse.json({ ok: true, rdvsProcessed: rdvs.length, emailsSent: sent });
  } catch (err) {
    await sql.end().catch(() => null);
    console.error('RDV reminder error:', err);
    return NextResponse.json({ error: 'Erreur traitement rappels.' }, { status: 500 });
  }
}

function buildRdvReminderGarageEmail(p: {
  rdv: Record<string, unknown>; typeLabel: string; dateStr: string; timeStr: string;
  vehicleLabel: string | null; baseUrl: string;
}): string {
  return `
<div style="font-family:sans-serif;max-width:600px;margin:auto">
  <div style="background:#18181b;color:#fafafa;padding:20px 24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:18px">📅 RDV demain — ${p.typeLabel}</h1>
    <p style="margin:4px 0 0;color:#a1a1aa;font-size:13px">${p.dateStr} à ${p.timeStr}</p>
  </div>
  <div style="background:#27272a;color:#eee;padding:24px;border-radius:0 0 12px 12px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#a1a1aa">Client</td><td style="text-align:right;font-weight:600">${p.rdv.customer_name ?? '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#a1a1aa">Téléphone</td><td style="text-align:right">${p.rdv.customer_phone ? `<a href="tel:${p.rdv.customer_phone}" style="color:#4ade80">${p.rdv.customer_phone}</a>` : '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#a1a1aa">Type</td><td style="text-align:right">${p.typeLabel}</td></tr>
      ${p.vehicleLabel ? `<tr><td style="padding:6px 0;color:#a1a1aa">Véhicule</td><td style="text-align:right">${p.vehicleLabel}</td></tr>` : ''}
      <tr><td style="padding:6px 0;color:#a1a1aa">Durée</td><td style="text-align:right">${p.rdv.duration_minutes} min</td></tr>
      ${p.rdv.notes ? `<tr><td style="padding:6px 0;color:#a1a1aa">Notes</td><td style="text-align:right;color:#a1a1aa;font-size:13px">${p.rdv.notes}</td></tr>` : ''}
    </table>
    <a href="${p.baseUrl}/gp/atelier" style="display:inline-block;margin-top:20px;background:#3f3f46;color:#fff;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none">Voir l'Atelier →</a>
  </div>
</div>`;
}

function buildRdvReminderClientEmail(p: {
  rdv: Record<string, unknown>; typeLabel: string; dateStr: string; timeStr: string;
  vehicleLabel: string | null;
}): string {
  return `
<div style="font-family:sans-serif;max-width:600px;margin:auto">
  <div style="background:#18181b;color:#fafafa;padding:20px 24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:18px">Rappel de votre rendez-vous</h1>
    <p style="margin:4px 0 0;color:#a1a1aa;font-size:13px">GP-CARS</p>
  </div>
  <div style="background:#27272a;color:#eee;padding:24px;border-radius:0 0 12px 12px">
    <p style="color:#e4e4e7">Bonjour ${p.rdv.customer_name ?? ''},</p>
    <p style="color:#e4e4e7">Nous vous rappelons votre rendez-vous <strong>${p.typeLabel}</strong> chez GP-CARS :</p>
    <div style="background:#3f3f46;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0;font-size:18px;font-weight:700;color:#fafafa">${p.dateStr}</p>
      <p style="margin:4px 0 0;font-size:16px;color:#a1a1aa">${p.timeStr} · ${p.rdv.duration_minutes} minutes</p>
      ${p.vehicleLabel ? `<p style="margin:8px 0 0;color:#a1a1aa;font-size:13px">${p.vehicleLabel}</p>` : ''}
    </div>
    <p style="color:#a1a1aa;font-size:13px">En cas d'empêchement, contactez-nous au plus vite :<br/><a href="mailto:info.gpcars@gmail.com" style="color:#60a5fa">info.gpcars@gmail.com</a></p>
    <p style="margin-top:24px;color:#71717a;font-size:12px">GP-CARS · Belgique</p>
  </div>
</div>`;
}
