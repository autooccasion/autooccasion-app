// lib/events/publish.ts
// Central event publisher — fires immediate alerts for critical events
// and persists all events to SystemEvent table for audit trail.

import { sendEmail } from '@/lib/email';
import { publishEvent } from 'app/db';

const NOTIFY = process.env.NOTIFY_EMAIL ?? '';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? '';

export type EventType =
  | 'opportunite.or'
  | 'opportunite.vert'
  | 'lead.rouge'
  | 'lead.orange'
  | 'stock.immobilise'
  | 'analyse.low_confidence'
  | 'prix.baisse'
  | 'vehicule.vendu';

export interface EventPayload {
  'opportunite.or': {
    vehicleId: number;
    vehicleLabel: string;
    maxBuyPrice: number;
    estimatedMargin: number;
    confidence: number;
    listingUrl?: string;
  };
  'opportunite.vert': {
    vehicleId: number;
    vehicleLabel: string;
    maxBuyPrice: number;
    estimatedMargin: number;
    listingUrl?: string;
  };
  'lead.rouge': {
    leadId: number;
    prospectName: string;
    prospectPhone?: string;
    vehicleSearch: string;
    budget?: number;
    score: number;
    summary: string;
    actionRecommended?: string;
  };
  'lead.orange': {
    leadId: number;
    prospectName: string;
    vehicleSearch: string;
    budget?: number;
    score: number;
  };
  'stock.immobilise': {
    vehicleId: number;
    vehicleLabel: string;
    daysInStock: number;
    askingPrice?: number;
  };
  'analyse.low_confidence': {
    vehicleId: number;
    vehicleLabel: string;
    confidence: number;
    reason: string;
  };
  'prix.baisse': {
    vehicleId: number;
    vehicleLabel: string;
    listingUrl: string;
    oldPrice: number;
    newPrice: number;
    drop: number;
  };
  'vehicule.vendu': {
    vehicleId: number;
    vehicleLabel: string;
    realMargin: number;
    soldInDays: number;
  };
}

// Persist event + fire immediate email for critical events.
export async function emit<T extends EventType>(
  type: T,
  source: string,
  payload: EventPayload[T],
): Promise<void> {
  // Always persist
  try {
    await publishEvent(type, source, payload as Record<string, unknown>);
  } catch {
    // Non-blocking — don't crash the caller if DB is unavailable
  }

  // Immediate email for critical events
  if (!NOTIFY) return;

  try {
    if (type === 'opportunite.or') {
      const p = payload as EventPayload['opportunite.or'];
      await sendEmail({
        to: NOTIFY,
        subject: `🏆 GP-CARS · OPPORTUNITÉ OR — ${p.vehicleLabel}`,
        html: buildOrEmail(p),
      });
    } else if (type === 'lead.rouge') {
      const p = payload as EventPayload['lead.rouge'];
      await sendEmail({
        to: NOTIFY,
        subject: `🔴 GP-CARS · Lead ROUGE — ${p.prospectName} · Score ${p.score}/100`,
        html: buildLeadRougeEmail(p),
      });
    } else if (type === 'stock.immobilise') {
      const p = payload as EventPayload['stock.immobilise'];
      await sendEmail({
        to: NOTIFY,
        subject: `⚠️ GP-CARS · Véhicule immobilisé ${p.daysInStock}j — ${p.vehicleLabel}`,
        html: buildStockImmobiliseEmail(p),
      });
    } else if (type === 'prix.baisse') {
      const p = payload as EventPayload['prix.baisse'];
      await sendEmail({
        to: NOTIFY,
        subject: `📉 GP-CARS · Baisse de prix −${p.drop}€ — ${p.vehicleLabel}`,
        html: buildPrixBaisseEmail(p),
      });
    }
  } catch {
    // Email failure is non-blocking
  }
}

// ──────────────────────────────────────────────
// HTML email templates
// ──────────────────────────────────────────────

function buildOrEmail(p: EventPayload['opportunite.or']): string {
  const leadsUrl = `${BASE_URL}/gp/stock`;
  return `
<div style="font-family:sans-serif;max-width:600px;margin:auto">
  <div style="background:#111;color:#ffd700;padding:20px 24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:22px">🏆 OPPORTUNITÉ OR</h1>
    <p style="margin:4px 0 0;color:#ccc;font-size:14px">Carmelo a détecté une opportunité rare</p>
  </div>
  <div style="background:#1a1a1a;color:#eee;padding:24px;border-radius:0 0 12px 12px">
    <h2 style="color:#ffd700;font-size:18px;margin:0 0 16px">${p.vehicleLabel}</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#aaa">Prix d'achat maximum</td><td style="text-align:right;font-weight:700;color:#4ade80">${p.maxBuyPrice.toLocaleString('fr-BE')} €</td></tr>
      <tr><td style="padding:6px 0;color:#aaa">Marge estimée</td><td style="text-align:right;font-weight:700;color:#4ade80">+${p.estimatedMargin.toLocaleString('fr-BE')} €</td></tr>
      <tr><td style="padding:6px 0;color:#aaa">Confiance Carmelo</td><td style="text-align:right;font-weight:700">${p.confidence} %</td></tr>
    </table>
    ${p.listingUrl ? `<a href="${p.listingUrl}" style="display:inline-block;margin-top:20px;background:#ffd700;color:#111;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none">Voir l'annonce →</a>` : ''}
    <a href="${leadsUrl}" style="display:inline-block;margin-top:12px;margin-left:${p.listingUrl ? '12px' : '0'};background:#333;color:#fff;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">Voir dans GP-CARS →</a>
    <p style="margin-top:24px;color:#666;font-size:12px">⚡ Cette alerte est immédiate — agir rapidement.</p>
  </div>
</div>`;
}

function buildLeadRougeEmail(p: EventPayload['lead.rouge']): string {
  const leadsUrl = `${BASE_URL}/gp/leads`;
  return `
<div style="font-family:sans-serif;max-width:600px;margin:auto">
  <div style="background:#dc2626;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:22px">🔴 LEAD ROUGE — ${p.prospectName}</h1>
    <p style="margin:4px 0 0;color:#fca5a5;font-size:14px">Score ${p.score}/100 · Prospect très chaud</p>
  </div>
  <div style="background:#1a1a1a;color:#eee;padding:24px;border-radius:0 0 12px 12px">
    <table style="width:100%;border-collapse:collapse">
      ${p.prospectPhone ? `<tr><td style="padding:6px 0;color:#aaa">Téléphone</td><td style="text-align:right;font-weight:700"><a href="tel:${p.prospectPhone}" style="color:#4ade80">${p.prospectPhone}</a></td></tr>` : ''}
      <tr><td style="padding:6px 0;color:#aaa">Recherche</td><td style="text-align:right">${p.vehicleSearch}</td></tr>
      ${p.budget ? `<tr><td style="padding:6px 0;color:#aaa">Budget</td><td style="text-align:right;font-weight:700">${p.budget.toLocaleString('fr-BE')} €</td></tr>` : ''}
      <tr><td style="padding:6px 0;color:#aaa">Score MADORE</td><td style="text-align:right;font-weight:700;color:#fbbf24">${p.score}/100</td></tr>
    </table>
    <div style="margin-top:16px;padding:12px;background:#2a1f1f;border-left:3px solid #dc2626;border-radius:4px">
      <p style="margin:0;font-size:13px;color:#ccc">${p.summary}</p>
    </div>
    ${p.actionRecommended ? `<div style="margin-top:12px;padding:12px;background:#1f2a1f;border-left:3px solid #4ade80;border-radius:4px"><p style="margin:0;font-size:13px;color:#86efac">Action : ${p.actionRecommended}</p></div>` : ''}
    <a href="${leadsUrl}" style="display:inline-block;margin-top:20px;background:#dc2626;color:#fff;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none">Voir tous les leads →</a>
    <p style="margin-top:16px;color:#666;font-size:12px">⚡ Rappeler dans les 2h pour maximiser la conversion.</p>
  </div>
</div>`;
}

function buildStockImmobiliseEmail(p: EventPayload['stock.immobilise']): string {
  const stockUrl = `${BASE_URL}/gp/stock`;
  return `
<div style="font-family:sans-serif;max-width:600px;margin:auto">
  <div style="background:#d97706;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:22px">⚠️ STOCK IMMOBILISÉ — ${p.daysInStock} jours</h1>
    <p style="margin:4px 0 0;color:#fde68a;font-size:14px">Action requise sur ce véhicule</p>
  </div>
  <div style="background:#1a1a1a;color:#eee;padding:24px;border-radius:0 0 12px 12px">
    <h2 style="color:#fbbf24;margin:0 0 16px">${p.vehicleLabel}</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#aaa">Jours en stock</td><td style="text-align:right;font-weight:700;color:#f87171">${p.daysInStock} jours</td></tr>
      ${p.askingPrice ? `<tr><td style="padding:6px 0;color:#aaa">Prix actuel</td><td style="text-align:right;font-weight:700">${p.askingPrice.toLocaleString('fr-BE')} €</td></tr>` : ''}
    </table>
    <div style="margin-top:16px;padding:12px;background:#2a2000;border-left:3px solid #d97706;border-radius:4px">
      <p style="margin:0;font-size:13px;color:#fde68a">Recommandation : baisser le prix de 300 à 500 € ou contacter les prospects MADORE en attente.</p>
    </div>
    <a href="${stockUrl}" style="display:inline-block;margin-top:20px;background:#d97706;color:#fff;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none">Voir le stock →</a>
  </div>
</div>`;
}

function buildPrixBaisseEmail(p: EventPayload['prix.baisse']): string {
  return `
<div style="font-family:sans-serif;max-width:600px;margin:auto">
  <div style="background:#2563eb;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:22px">📉 BAISSE DE PRIX — −${p.drop.toLocaleString('fr-BE')} €</h1>
    <p style="margin:4px 0 0;color:#bfdbfe;font-size:14px">Un vendeur a baissé son prix — réévaluer l'opportunité</p>
  </div>
  <div style="background:#1a1a1a;color:#eee;padding:24px;border-radius:0 0 12px 12px">
    <h2 style="color:#60a5fa;margin:0 0 16px">${p.vehicleLabel}</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#aaa">Ancien prix</td><td style="text-align:right;text-decoration:line-through;color:#9ca3af">${p.oldPrice.toLocaleString('fr-BE')} €</td></tr>
      <tr><td style="padding:6px 0;color:#aaa">Nouveau prix</td><td style="text-align:right;font-weight:700;color:#4ade80">${p.newPrice.toLocaleString('fr-BE')} €</td></tr>
      <tr><td style="padding:6px 0;color:#aaa">Réduction</td><td style="text-align:right;font-weight:700;color:#f87171">−${p.drop.toLocaleString('fr-BE')} €</td></tr>
    </table>
    <a href="${p.listingUrl}" target="_blank" style="display:inline-block;margin-top:20px;background:#2563eb;color:#fff;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none">Voir l'annonce →</a>
  </div>
</div>`;
}
