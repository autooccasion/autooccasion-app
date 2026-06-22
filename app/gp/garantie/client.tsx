'use client';

import { useState } from 'react';
import type { WarrantyRecord, WarrantyCaseRecord, WarrantyCaseStatus, WarrantyCaseSeverity } from 'app/db';

const STATUS_CONFIG: Record<WarrantyCaseStatus, { label: string; style: string }> = {
  ouvert:    { label: 'Ouvert',    style: 'bg-yellow-950 text-yellow-300 border-yellow-800' },
  en_cours:  { label: 'En cours',  style: 'bg-blue-950 text-blue-300 border-blue-800' },
  resolu:    { label: 'Résolu',    style: 'bg-green-950 text-green-300 border-green-800' },
  rejete:    { label: 'Rejeté',    style: 'bg-zinc-800 text-zinc-400 border-zinc-600' },
  litige:    { label: 'Litige',    style: 'bg-red-950 text-red-300 border-red-800' },
};

const SEVERITY_CONFIG: Record<WarrantyCaseSeverity, { label: string; style: string }> = {
  mineur:   { label: 'Mineur',   style: 'bg-zinc-800 text-zinc-400 border-zinc-600' },
  modere:   { label: 'Modéré',   style: 'bg-yellow-950 text-yellow-300 border-yellow-800' },
  grave:    { label: 'Grave',    style: 'bg-orange-950 text-orange-300 border-orange-800' },
  critique: { label: 'Critique', style: 'bg-red-950 text-red-300 border-red-800' },
};

type VehicleInfo = {
  id: number;
  make: string | null;
  model: string | null;
  year: number | null;
};

type Props = {
  initialWarranties: WarrantyRecord[];
  initialCases: WarrantyCaseRecord[];
  vehicles: VehicleInfo[];
};

function euro(n: number | null | undefined): string {
  return n == null ? '—' : `${n.toLocaleString('fr-BE')} €`;
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
}

function warrantyExpiryStatus(w: WarrantyRecord): 'expired' | 'expiring' | 'valid' {
  const now = new Date();
  const expires = new Date(w.legalExpiresAt);
  const diffDays = Math.ceil((expires.getTime() - now.getTime()) / 86_400_000);
  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'expiring';
  return 'valid';
}

const EXPIRY_STYLE = {
  valid:    'text-green-400',
  expiring: 'text-yellow-400',
  expired:  'text-red-400',
};

const EXPIRY_LABEL = {
  valid:    'En cours',
  expiring: 'Expire bientôt',
  expired:  'Expirée',
};

export default function GarantieClient({ initialWarranties, initialCases, vehicles }: Props) {
  const [warranties, setWarranties] = useState<WarrantyRecord[]>(initialWarranties);
  const [cases, setCases] = useState<WarrantyCaseRecord[]>(initialCases);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [showNewCase, setShowNewCase] = useState<number | null>(null); // warrantyId
  const [showNewWarranty, setShowNewWarranty] = useState(false);

  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

  function vehicleLabel(vehicleId: number): string {
    const v = vehicleMap.get(vehicleId);
    if (!v) return `Véhicule #${vehicleId}`;
    return [v.make, v.model, v.year].filter(Boolean).join(' ') || `Véhicule #${vehicleId}`;
  }

  async function updateCaseStatus(id: number, status: WarrantyCaseStatus) {
    setLoadingId(id);
    setMsg('');
    try {
      const res = await fetch(`/api/garantie/cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.case) {
          if (status === 'resolu' || status === 'rejete') {
            setCases((prev) => prev.filter((c) => c.id !== id));
          } else {
            setCases((prev) => prev.map((c) => c.id === id ? data.case : c));
          }
        }
      } else {
        setMsg('Erreur lors de la mise à jour.');
      }
    } catch {
      setMsg('Erreur réseau.');
    } finally {
      setLoadingId(null);
    }
  }

  async function addCase(warrantyId: number, form: { description: string; severity: string; estimatedCost: string }) {
    setMsg('');
    try {
      const res = await fetch('/api/garantie/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warrantyId,
          description: form.description,
          severity: form.severity,
          estimatedCost: form.estimatedCost || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.case) {
          setCases((prev) => [data.case, ...prev]);
          setShowNewCase(null);
        }
      } else {
        const d = await res.json().catch(() => ({}));
        setMsg(d.error || 'Erreur.');
      }
    } catch {
      setMsg('Erreur réseau.');
    }
  }

  async function addWarranty(form: NewWarrantyForm) {
    setMsg('');
    try {
      const res = await fetch('/api/garantie/warranties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: parseInt(form.vehicleId, 10),
          buyerName: form.buyerName || null,
          buyerEmail: form.buyerEmail || null,
          buyerPhone: form.buyerPhone || null,
          buyerType: form.buyerType,
          warrantyType: form.warrantyType,
          soldPrice: form.soldPrice || null,
          soldAt: form.soldAt,
          contractMonths: form.contractMonths || null,
          notes: form.notes || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.warranty) {
          setWarranties((prev) => [data.warranty, ...prev]);
          setShowNewWarranty(false);
        }
      } else {
        const d = await res.json().catch(() => ({}));
        setMsg(d.error || 'Erreur.');
      }
    } catch {
      setMsg('Erreur réseau.');
    }
  }

  return (
    <div className="space-y-6">
      {msg && (
        <p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded px-3 py-2">{msg}</p>
      )}

      {/* Legal info panel */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Droit belge — Garantie légale</p>
        <p className="text-xs text-zinc-400 leading-relaxed">
          2 ans pour les particuliers · 1 an pour les professionnels · Non couverts : usure normale (pneus, freins, courroies, balais d&apos;essuie-glace) · Après 1 an : charge de la preuve sur l&apos;acheteur
        </p>
      </div>

      {/* Open cases */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-100">Dossiers ouverts ({cases.length})</h2>
        </div>

        {cases.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 text-sm text-zinc-400">
            Aucun dossier ouvert.
          </div>
        )}

        <div className="space-y-2">
          {cases.map((c) => {
            const sc = STATUS_CONFIG[c.status as WarrantyCaseStatus] ?? STATUS_CONFIG.ouvert;
            const sv = SEVERITY_CONFIG[c.severity as WarrantyCaseSeverity] ?? SEVERITY_CONFIG.modere;
            const isLoading = loadingId === c.id;
            const w = warranties.find((w) => w.id === c.warrantyId);
            const vLabel = w ? vehicleLabel(w.vehicleId) : `Garantie #${c.warrantyId}`;
            return (
              <div key={c.id} className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${sc.style}`}>{sc.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${sv.style}`}>{sv.label}</span>
                    <span className="text-xs text-zinc-500">{vLabel}</span>
                  </div>
                  <p className="text-sm text-zinc-200">{c.description}</p>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
                    {c.estimatedCost != null && <span>Estimé: {euro(c.estimatedCost)}</span>}
                    {c.actualCost != null && <span>Réel: {euro(c.actualCost)}</span>}
                    <span>Ouvert: {formatDate(c.openedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {c.status === 'ouvert' && (
                    <button
                      disabled={isLoading}
                      onClick={() => updateCaseStatus(c.id, 'en_cours')}
                      className="px-2.5 py-1 text-xs rounded-lg bg-blue-950 text-blue-300 border border-blue-800 hover:bg-blue-900 disabled:opacity-40 transition-colors"
                    >
                      {isLoading ? '…' : 'Prendre en charge'}
                    </button>
                  )}
                  {(c.status === 'ouvert' || c.status === 'en_cours') && (
                    <button
                      disabled={isLoading}
                      onClick={() => updateCaseStatus(c.id, 'resolu')}
                      className="px-2.5 py-1 text-xs rounded-lg bg-green-950 text-green-300 border border-green-800 hover:bg-green-900 disabled:opacity-40 transition-colors"
                    >
                      {isLoading ? '…' : 'Résoudre'}
                    </button>
                  )}
                  {c.status !== 'rejete' && (
                    <button
                      disabled={isLoading}
                      onClick={() => updateCaseStatus(c.id, 'rejete')}
                      className="px-2.5 py-1 text-xs rounded-lg bg-zinc-800 text-zinc-400 hover:text-red-300 hover:bg-red-950 border border-zinc-700 hover:border-red-800 disabled:opacity-40 transition-colors"
                    >
                      {isLoading ? '…' : 'Rejeter'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Warranties list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-100">Garanties enregistrées ({warranties.length})</h2>
          <button
            onClick={() => setShowNewWarranty(!showNewWarranty)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors"
          >
            {showNewWarranty ? '✕ Annuler' : '+ Nouvelle garantie'}
          </button>
        </div>

        {showNewWarranty && (
          <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-4 mb-4">
            <NewWarrantyForm
              vehicles={vehicles}
              onSubmit={addWarranty}
              onCancel={() => setShowNewWarranty(false)}
            />
          </div>
        )}

        {warranties.length === 0 && !showNewWarranty && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 text-sm text-zinc-400">
            Aucune garantie enregistrée. Ajoutez une garantie lors de la vente d&apos;un véhicule.
          </div>
        )}

        <div className="space-y-2">
          {warranties.map((w) => {
            const status = warrantyExpiryStatus(w);
            const statusStyle = EXPIRY_STYLE[status];
            const statusLabel = EXPIRY_LABEL[status];
            const isOpenCase = showNewCase === w.id;
            return (
              <div key={w.id} className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
                <div className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-100">{vehicleLabel(w.vehicleId)}</span>
                      <span className={`text-xs font-medium ${statusStyle}`}>{statusLabel}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
                      <span>{w.buyerType === 'particulier' ? 'Particulier' : 'Professionnel'}</span>
                      {w.buyerName && <span>{w.buyerName}</span>}
                      <span>Vendu: {formatDate(w.soldAt)}</span>
                      <span>Expire: <span className={statusStyle}>{formatDate(w.legalExpiresAt)}</span></span>
                      {w.soldPrice && <span>Prix: {euro(w.soldPrice)}</span>}
                    </div>
                    {w.warrantyType === 'contractuelle' && w.contractExpiresAt && (
                      <p className="text-xs text-zinc-500">Garantie contractuelle jusqu&apos;au {formatDate(w.contractExpiresAt)}</p>
                    )}
                    {w.notes && <p className="text-xs text-zinc-500 italic">{w.notes}</p>}
                  </div>
                  <button
                    onClick={() => setShowNewCase(isOpenCase ? null : w.id)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-600 transition-colors shrink-0"
                  >
                    {isOpenCase ? '✕' : '+ Dossier'}
                  </button>
                </div>

                {isOpenCase && (
                  <div className="border-t border-zinc-800 bg-zinc-950 p-4">
                    <NewCaseForm
                      onSubmit={(f) => addCase(w.id, f)}
                      onCancel={() => setShowNewCase(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type NewWarrantyForm = {
  vehicleId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerType: string;
  warrantyType: string;
  soldPrice: string;
  soldAt: string;
  contractMonths: string;
  notes: string;
};

function NewWarrantyForm({
  vehicles,
  onSubmit,
  onCancel,
}: {
  vehicles: VehicleInfo[];
  onSubmit: (form: NewWarrantyForm) => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<NewWarrantyForm>({
    vehicleId: vehicles[0]?.id.toString() ?? '',
    buyerName: '',
    buyerEmail: '',
    buyerPhone: '',
    buyerType: 'particulier',
    warrantyType: 'legale',
    soldPrice: '',
    soldAt: today,
    contractMonths: '',
    notes: '',
  });

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Nouvelle garantie</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Véhicule</label>
          <select
            value={form.vehicleId}
            onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id.toString()}>
                {[v.make, v.model, v.year].filter(Boolean).join(' ') || `#${v.id}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Date de vente</label>
          <input
            type="date"
            value={form.soldAt}
            onChange={(e) => setForm((f) => ({ ...f, soldAt: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Type acheteur</label>
          <select
            value={form.buyerType}
            onChange={(e) => setForm((f) => ({ ...f, buyerType: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
          >
            <option value="particulier">Particulier (2 ans légal)</option>
            <option value="professionnel">Professionnel (1 an légal)</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Type garantie</label>
          <select
            value={form.warrantyType}
            onChange={(e) => setForm((f) => ({ ...f, warrantyType: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
          >
            <option value="legale">Légale</option>
            <option value="contractuelle">Contractuelle</option>
            <option value="aucune">Aucune</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Nom acheteur</label>
          <input
            type="text"
            value={form.buyerName}
            onChange={(e) => setForm((f) => ({ ...f, buyerName: e.target.value }))}
            placeholder="Jean Dupont"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Téléphone</label>
          <input
            type="tel"
            value={form.buyerPhone}
            onChange={(e) => setForm((f) => ({ ...f, buyerPhone: e.target.value }))}
            placeholder="+32 4..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Email acheteur</label>
          <input
            type="email"
            value={form.buyerEmail}
            onChange={(e) => setForm((f) => ({ ...f, buyerEmail: e.target.value }))}
            placeholder="jean@..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Prix de vente (€)</label>
          <input
            type="number"
            value={form.soldPrice}
            onChange={(e) => setForm((f) => ({ ...f, soldPrice: e.target.value }))}
            placeholder="0"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
          />
        </div>
        {form.warrantyType === 'contractuelle' && (
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Durée contractuelle (mois)</label>
            <select
              value={form.contractMonths}
              onChange={(e) => setForm((f) => ({ ...f, contractMonths: e.target.value }))}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
            >
              <option value="6">6 mois</option>
              <option value="12">12 mois</option>
              <option value="24">24 mois</option>
            </select>
          </div>
        )}
      </div>
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Notes</label>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Remarques..."
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(form)}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors"
        >
          Enregistrer
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function NewCaseForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (form: { description: string; severity: string; estimatedCost: string }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ description: '', severity: 'modere', estimatedCost: '' });
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Nouveau dossier</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Gravité</label>
          <select
            value={form.severity}
            onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
          >
            <option value="mineur">Mineur</option>
            <option value="modere">Modéré</option>
            <option value="grave">Grave</option>
            <option value="critique">Critique</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Coût estimé (€)</label>
          <input
            type="number"
            value={form.estimatedCost}
            onChange={(e) => setForm((f) => ({ ...f, estimatedCost: e.target.value }))}
            placeholder="0"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Description du problème</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Décrire le défaut constaté par le client..."
          rows={3}
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100 resize-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(form)}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors"
        >
          Ouvrir le dossier
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
