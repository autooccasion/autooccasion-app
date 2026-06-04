'use client';

import { useState } from 'react';

type Props = {
  vehicle: { id: number; status: string; listingTitle: string | null; confidence: number | null };
};

export default function StockActions({ vehicle }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

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

  const s = vehicle.status;
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {s === 'analyse' && (
        <Btn label="Marquer acheté" loading={loading === 'achete'} onClick={() => call('set_status', { status: 'achete' })} />
      )}
      {s === 'achete' && (
        <Btn label="Mettre en stock" loading={loading === 'en_stock'} onClick={() => call('set_status', { status: 'en_stock' })} />
      )}
      {(s === 'en_stock' || s === 'achete') && (
        <Btn label="✍️ Rédiger annonce" loading={loading === 'listing'} onClick={draftListing} />
      )}
      {s === 'en_stock' && vehicle.listingTitle && (
        <Btn label="Marquer publié" loading={loading === 'publie'} onClick={() => call('set_status', { status: 'publie', platforms: ['AutoScout24'] })} />
      )}
      {s === 'publie' && (
        <SaleForm id={vehicle.id} loading={loading === 'sale'} onSell={(price) => call('record_sale', { realSellPrice: price, soldAt: new Date().toISOString() })} />
      )}
      {(s === 'analyse' || s === 'achete') && (
        <Btn label="🔍 Contrôler" loading={loading === 'controller'} onClick={runController} variant="subtle" />
      )}
      {s !== 'refuse' && s !== 'vendu' && (
        <Btn label="Refuser" loading={loading === 'refuse'} onClick={() => call('set_status', { status: 'refuse' })} variant="danger" />
      )}
      {msg && <p className="text-xs text-zinc-400 ml-1">{msg}</p>}
    </div>
  );
}

function Btn({ label, loading, onClick, variant = 'primary' }: { label: string; loading: boolean; onClick: () => void; variant?: 'primary' | 'subtle' | 'danger' }) {
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

function SaleForm({ id, loading, onSell }: { id: number; loading: boolean; onSell: (price: number) => void }) {
  const [price, setPrice] = useState('');
  return (
    <div className="flex items-center gap-2">
      <input
        type="number" value={price} onChange={(e) => setPrice(e.target.value)}
        placeholder="Prix de vente €"
        className="w-32 bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-xs text-zinc-100"
      />
      <Btn label="Enregistrer la vente" loading={loading} onClick={() => { const n = Number(price); if (n > 0) onSell(n); }} />
    </div>
  );
}
