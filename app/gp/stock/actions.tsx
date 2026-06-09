'use client';

import { useState } from 'react';
import Link from 'next/link';

type VehicleProps = {
  id: number;
  status: string;
  listingTitle: string | null;
  confidence: number | null;
  make: string | null;
  model: string | null;
  year: number | null;
  km: number | null;
  askingPrice: number | null;
  maxBuyPrice: number | null;
  listingUrl: string | null;
};

export default function StockActions({ vehicle }: { vehicle: VehicleProps }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [contactDraft, setContactDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function call(action: string, extra?: Record<string, unknown>) {
    setLoading(action);
    setMsg('');
    try {
      const res = await fetch('/api/agents/vehicle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id: vehicle.id, ...extra }),
      });
      if (res.ok) {
        setMsg('✓ Mis à jour');
        setTimeout(() => window.location.reload(), 800);
      } else {
        const d = await res.json().catch(() => ({}));
        setMsg(d.error || 'Erreur.');
      }
    } catch { setMsg('Erreur réseau.'); }
    finally { setLoading(null); }
  }

  async function draftListing() {
    setLoading('listing');
    setMsg('');
    try {
      const res = await fetch('/api/agents/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId: vehicle.id }),
      });
      if (res.ok) { setMsg('✓ Annonce rédigée'); setTimeout(() => window.location.reload(), 800); }
      else { const d = await res.json().catch(() => ({})); setMsg(d.error || 'Erreur.'); }
    } catch { setMsg('Erreur réseau.'); }
    finally { setLoading(null); }
  }

  async function runController() {
    setLoading('controller');
    setMsg('');
    try {
      const res = await fetch('/api/agents/controller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId: vehicle.id }),
      });
      if (res.ok) { setMsg('✓ Contrôle effectué'); setTimeout(() => window.location.reload(), 800); }
      else { const d = await res.json().catch(() => ({})); setMsg(d.error || 'Erreur.'); }
    } catch { setMsg('Erreur réseau.'); }
    finally { setLoading(null); }
  }

  async function draftContact() {
    setLoading('contact');
    setMsg('');
    setContactDraft(null);
    const vehiculeLabel = [vehicle.make, vehicle.model, vehicle.year, vehicle.km != null ? `${vehicle.km.toLocaleString('fr-BE')} km` : null]
      .filter(Boolean).join(' ');
    try {
      const res = await fetch('/api/carmelo/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicule: vehiculeLabel || 'véhicule',
          askingPrice: vehicle.askingPrice,
          targetPrice: vehicle.maxBuyPrice,
          langue: 'fr',
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setContactDraft(d.message || '');
      } else {
        const d = await res.json().catch(() => ({}));
        setMsg(d.error || 'Erreur lors de la rédaction du message.');
      }
    } catch { setMsg('Erreur réseau.'); }
    finally { setLoading(null); }
  }

  async function copyContact() {
    if (!contactDraft) return;
    await navigator.clipboard.writeText(contactDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const s = vehicle.status;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 pt-1">

        {/* Transitions de statut */}
        {s === 'analyse' && (
          <Btn label="Marquer acheté" loading={loading === 'achete'} onClick={() => call('set_status', { status: 'achete' })} />
        )}
        {s === 'achete' && (
          <Btn
            label="Mettre en stock"
            loading={loading === 'en_stock'}
            onClick={async () => {
              await call('set_status', { status: 'en_stock' });
              // Auto-draft listing if none exists yet.
              if (!vehicle.listingTitle) {
                await fetch('/api/agents/marketing', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ vehicleId: vehicle.id }),
                }).catch(() => null);
              }
            }}
          />
        )}
        {(s === 'en_stock' || s === 'achete') && (
          <Btn label="✍️ Rédiger annonce" loading={loading === 'listing'} onClick={draftListing} />
        )}
        {s === 'en_stock' && vehicle.listingTitle && (
          <Btn label="Marquer publié" loading={loading === 'publie'} onClick={() => call('set_status', { status: 'publie', platforms: ['AutoScout24'] })} />
        )}
        {s === 'publie' && (
          <SaleForm
            id={vehicle.id}
            loading={loading === 'sale'}
            onSell={(price) => call('record_sale', { realSellPrice: price, soldAt: new Date().toISOString() })}
          />
        )}

        {/* Prise de contact vendeur — visible pour les prospects/analysés avec URL */}
        {(s === 'analyse' || s === 'prospect') && (
          <Btn label="✉️ Préparer contact" loading={loading === 'contact'} onClick={draftContact} variant="subtle" />
        )}

        {/* Contrôleur manuel */}
        {(s === 'analyse' || s === 'achete') && (
          <Btn label="🔍 Contrôler" loading={loading === 'controller'} onClick={runController} variant="subtle" />
        )}

        {/* Voir le détail */}
        <Link
          href={`/gp/vehicle/${vehicle.id}`}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          Détail ↗
        </Link>

        {/* Refus */}
        {s !== 'refuse' && s !== 'vendu' && (
          <Btn label="Refuser" loading={loading === 'refuse'} onClick={() => call('set_status', { status: 'refuse' })} variant="danger" />
        )}

        {msg && <p className="text-xs text-zinc-400 ml-1">{msg}</p>}
      </div>

      {/* Panneau de contact — affiché après génération */}
      {contactDraft != null && (
        <div className="bg-zinc-800 border border-zinc-600 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
              Message de prise de contact
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={copyContact}
                className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-200 transition-colors"
              >
                {copied ? '✓ Copié' : '📋 Copier'}
              </button>
              <button
                onClick={() => setContactDraft(null)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>
          </div>
          <p className="text-xs text-yellow-400/80">
            ⚠️ Relisez et adaptez avant d&apos;envoyer. Carmelo ne contacte jamais lui-même.
          </p>
          <textarea
            readOnly
            value={contactDraft}
            rows={8}
            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs text-zinc-200 resize-y font-mono leading-relaxed"
          />
          {vehicle.listingUrl && (
            <a
              href={vehicle.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 underline hover:text-zinc-200"
            >
              Annonce source ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function Btn({
  label, loading, onClick, variant = 'primary',
}: {
  label: string; loading: boolean; onClick: () => void; variant?: 'primary' | 'subtle' | 'danger';
}) {
  const base = 'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40';
  const styles = {
    primary: 'bg-white text-black hover:bg-zinc-200',
    subtle:  'bg-zinc-800 text-zinc-200 hover:bg-zinc-700',
    danger:  'bg-red-950 text-red-300 border border-red-800 hover:bg-red-900',
  };
  return (
    <button disabled={loading} onClick={onClick} className={`${base} ${styles[variant]}`}>
      {loading ? '…' : label}
    </button>
  );
}

function SaleForm({
  id, loading, onSell,
}: {
  id: number; loading: boolean; onSell: (price: number) => void;
}) {
  const [price, setPrice] = useState('');
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Prix de vente €"
        className="w-32 bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-xs text-zinc-100"
      />
      <Btn
        label="Enregistrer la vente"
        loading={loading}
        onClick={() => { const n = Number(price); if (n > 0) onSell(n); }}
      />
    </div>
  );
}
