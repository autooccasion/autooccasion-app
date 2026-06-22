'use client';

import { useState } from 'react';
import type { WorkshopJobRecord, WorkshopJobType, WorkshopJobStatus } from 'app/db';

const JOB_TYPE_LABELS: Record<WorkshopJobType, string> = {
  entretien: 'Entretien',
  pneus: 'Pneus',
  freins: 'Freins',
  carrosserie: 'Carrosserie',
  ct: 'Contrôle technique',
  nettoyage: 'Nettoyage',
  autre: 'Autre',
};

const STATUS_CONFIG: Record<WorkshopJobStatus, { label: string; style: string }> = {
  planifie:  { label: 'Planifié',  style: 'bg-zinc-800 text-zinc-300 border-zinc-600' },
  en_cours:  { label: 'En cours',  style: 'bg-blue-950 text-blue-300 border-blue-800' },
  termine:   { label: 'Terminé',   style: 'bg-green-950 text-green-300 border-green-800' },
  annule:    { label: 'Annulé',    style: 'bg-red-950 text-red-300 border-red-800' },
};

type VehicleInfo = {
  id: number;
  make: string | null;
  model: string | null;
  year: number | null;
};

type Props = {
  initialJobs: WorkshopJobRecord[];
  vehicles: VehicleInfo[];
};

function euro(n: number | null): string {
  return n == null ? '—' : `${n.toLocaleString('fr-BE')} €`;
}

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
}

export default function AtelierClient({ initialJobs, vehicles }: Props) {
  const [jobs, setJobs] = useState<WorkshopJobRecord[]>(initialJobs);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [showAddForm, setShowAddForm] = useState<number | null>(null);

  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

  const grouped = new Map<number, WorkshopJobRecord[]>();
  for (const job of jobs) {
    const list = grouped.get(job.vehicleId) ?? [];
    list.push(job);
    grouped.set(job.vehicleId, list);
  }

  async function markStatus(id: number, status: WorkshopJobStatus) {
    setLoadingId(id);
    setMsg('');
    try {
      const res = await fetch(`/api/atelier/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.job) {
          setJobs((prev) => {
            if (status === 'termine' || status === 'annule') {
              return prev.filter((j) => j.id !== id);
            }
            return prev.map((j) => j.id === id ? data.job : j);
          });
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

  async function deleteJob(id: number) {
    setLoadingId(id);
    setMsg('');
    try {
      const res = await fetch(`/api/atelier/jobs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== id));
      } else {
        setMsg('Erreur lors de la suppression.');
      }
    } catch {
      setMsg('Erreur réseau.');
    } finally {
      setLoadingId(null);
    }
  }

  async function addJob(vehicleId: number, form: AddJobForm) {
    setMsg('');
    try {
      const res = await fetch('/api/atelier/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          type: form.type,
          description: form.description || null,
          supplier: form.supplier || null,
          estimatedCost: form.estimatedCost ? parseInt(form.estimatedCost, 10) : null,
          scheduledAt: form.scheduledAt || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.job) {
          setJobs((prev) => [data.job, ...prev]);
          setShowAddForm(null);
        }
      } else {
        const d = await res.json().catch(() => ({}));
        setMsg(d.error || 'Erreur.');
      }
    } catch {
      setMsg('Erreur réseau.');
    }
  }

  const vehicleIds = Array.from(grouped.keys());

  return (
    <div className="space-y-4">
      {msg && (
        <p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded px-3 py-2">{msg}</p>
      )}

      {vehicleIds.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 text-sm text-zinc-400">
          Aucun travail en cours. Ajoutez des travaux via la fiche véhicule dans le stock.
        </div>
      )}

      {vehicleIds.map((vehicleId) => {
        const vehicleJobs = grouped.get(vehicleId) ?? [];
        const vInfo = vehicleMap.get(vehicleId);
        const label = vInfo
          ? [vInfo.make, vInfo.model, vInfo.year].filter(Boolean).join(' ') || `Véhicule #${vehicleId}`
          : `Véhicule #${vehicleId}`;
        const totalEstimated = vehicleJobs.reduce((s, j) => s + (j.estimatedCost ?? 0), 0);
        const isAddOpen = showAddForm === vehicleId;

        return (
          <div key={vehicleId} className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div>
                <p className="text-sm font-semibold text-zinc-100">{label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {vehicleJobs.length} travail{vehicleJobs.length > 1 ? 'x' : ''} en cours
                  {totalEstimated > 0 && ` · estimé ${euro(totalEstimated)}`}
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(isAddOpen ? null : vehicleId)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors"
              >
                {isAddOpen ? '✕ Annuler' : '+ Travail'}
              </button>
            </div>

            {isAddOpen && (
              <div className="border-b border-zinc-800 bg-zinc-950 p-4">
                <AddJobForm vehicleId={vehicleId} onSubmit={(f) => addJob(vehicleId, f)} onCancel={() => setShowAddForm(null)} />
              </div>
            )}

            <div className="divide-y divide-zinc-800">
              {vehicleJobs.map((job) => {
                const sc = STATUS_CONFIG[job.status as WorkshopJobStatus] ?? STATUS_CONFIG.planifie;
                const typeLabel = JOB_TYPE_LABELS[job.type as WorkshopJobType] ?? job.type;
                const isLoading = loadingId === job.id;
                return (
                  <div key={job.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-zinc-100">{typeLabel}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${sc.style}`}>{sc.label}</span>
                      </div>
                      {job.description && (
                        <p className="text-xs text-zinc-400">{job.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
                        {job.supplier && <span>Fournisseur: {job.supplier}</span>}
                        {job.estimatedCost != null && <span>Estimé: {euro(job.estimatedCost)}</span>}
                        {job.actualCost != null && <span>Réel: {euro(job.actualCost)}</span>}
                        {job.scheduledAt && <span>Planifié: {formatDate(job.scheduledAt)}</span>}
                        <span>Créé: {formatDate(job.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {job.status === 'planifie' && (
                        <button
                          disabled={isLoading}
                          onClick={() => markStatus(job.id, 'en_cours')}
                          className="px-2.5 py-1 text-xs rounded-lg bg-blue-950 text-blue-300 border border-blue-800 hover:bg-blue-900 disabled:opacity-40 transition-colors"
                        >
                          {isLoading ? '…' : 'Démarrer'}
                        </button>
                      )}
                      {(job.status === 'planifie' || job.status === 'en_cours') && (
                        <button
                          disabled={isLoading}
                          onClick={() => markStatus(job.id, 'termine')}
                          className="px-2.5 py-1 text-xs rounded-lg bg-green-950 text-green-300 border border-green-800 hover:bg-green-900 disabled:opacity-40 transition-colors"
                        >
                          {isLoading ? '…' : 'Terminer'}
                        </button>
                      )}
                      <button
                        disabled={isLoading}
                        onClick={() => deleteJob(job.id)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-zinc-800 text-zinc-400 hover:text-red-300 hover:bg-red-950 border border-zinc-700 hover:border-red-800 disabled:opacity-40 transition-colors"
                      >
                        {isLoading ? '…' : 'Suppr.'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type AddJobForm = {
  type: string;
  description: string;
  supplier: string;
  estimatedCost: string;
  scheduledAt: string;
};

function AddJobForm({
  vehicleId, onSubmit, onCancel,
}: {
  vehicleId: number;
  onSubmit: (form: AddJobForm) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AddJobForm>({
    type: 'entretien',
    description: '',
    supplier: '',
    estimatedCost: '',
    scheduledAt: '',
  });

  void vehicleId;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Nouveau travail</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
          >
            {Object.entries(JOB_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Fournisseur</label>
          <input
            type="text"
            value={form.supplier}
            onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
            placeholder="Garage Dupont..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
          />
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
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Date planifiée</label>
          <input
            type="date"
            value={form.scheduledAt}
            onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Description</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Détails du travail..."
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(form)}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors"
        >
          Ajouter
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
