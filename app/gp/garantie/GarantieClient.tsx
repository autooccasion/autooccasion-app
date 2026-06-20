'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── types ───────────────────────────────────────────────────────────────────

interface Dossier {
  id: number;
  vehicleMake: string | null; vehicleModel: string | null; vehicleYear: number | null;
  vehicleVin: string | null; vehicleKmAtSale: number | null; vehicleKmNow: number | null;
  saleDate: string | null; invoiceNumber: string | null; warrantyDurationMonths: number | null;
  customerName: string | null; customerPhone: string | null; customerEmail: string | null;
  claimDate: string | null; claimDescription: string | null; symptoms: string | null;
  repairsAlreadyDone: string | null; usageType: string | null; maintenanceOk: boolean | null;
  category: string | null;
  coverageDecision: 'totale' | 'partielle' | 'refusee' | 'en_attente' | null;
  coveragePercent: number | null; clientContribution: number | null;
  riskScoreLegal: number | null; riskScoreFinancial: number | null;
  litigationProbability: number | null; garageSuccessProbability: number | null;
  confidenceLevel: number | null;
  status: string | null;
  aiAnalysis: string | null; aiRecommendation: string | null;
  aiStrengths: string[] | null; aiWeaknesses: string[] | null;
  aiLegalBasis: string[] | null; aiNextSteps: string[] | null;
  communicationEmail: string | null; communicationWhatsapp: string | null;
  communicationRefus: string | null; communicationTransaction: string | null;
  litigationPackage: Record<string, unknown> | null;
  internalNotes: string | null; createdAt: string | null;
}

const BLANK_FORM = {
  vehicleMake: '', vehicleModel: '', vehicleYear: '', vehicleVin: '',
  vehicleKmAtSale: '', vehicleKmNow: '',
  saleDate: '', invoiceNumber: '', warrantyDurationMonths: '12',
  customerName: '', customerPhone: '', customerEmail: '',
  claimDescription: '', symptoms: '', repairsAlreadyDone: '',
  usageType: 'normale', maintenanceOk: true, internalNotes: '',
};

// ─── constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  nouveau: 'Nouveau', en_analyse: 'En analyse', decision_prise: 'Décision prise',
  sav_en_cours: 'SAV en cours', resolu: 'Résolu', litige: 'Litige',
  expertise: 'Expertise', procedure: 'Procédure',
};
const STATUS_COLORS: Record<string, string> = {
  nouveau: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  en_analyse: 'bg-blue-950 text-blue-300 border-blue-800',
  decision_prise: 'bg-amber-950 text-amber-300 border-amber-800',
  sav_en_cours: 'bg-orange-950 text-orange-300 border-orange-800',
  resolu: 'bg-green-950 text-green-300 border-green-800',
  litige: 'bg-red-950 text-red-300 border-red-800',
  expertise: 'bg-purple-950 text-purple-300 border-purple-800',
  procedure: 'bg-red-950 text-red-200 border-red-700',
};
const COVERAGE_LABELS: Record<string, string> = {
  totale: '✓ Totale', partielle: '◑ Partielle', refusee: '✗ Refusée', en_attente: '— En attente',
};
const COVERAGE_COLORS: Record<string, string> = {
  totale: 'text-green-400', partielle: 'text-amber-400',
  refusee: 'text-red-400', en_attente: 'text-zinc-500',
};
const CAT_LABELS: Record<string, string> = {
  '1': 'Défaut de conformité', '2': 'Garantie applicable',
  '3': 'Garantie partielle', '4': 'Usure normale',
  '5': 'Défaut entretien', '6': 'Mauvaise utilisation', '7': 'Expertise requise',
};
const ALL_STATUSES = ['nouveau','en_analyse','decision_prise','sav_en_cours','resolu','litige','expertise','procedure'];

// ─── helpers ─────────────────────────────────────────────────────────────────

function riskColor(s: number | null) {
  if (s == null) return 'text-zinc-600';
  return s >= 70 ? 'text-red-400 font-semibold' : s >= 40 ? 'text-amber-400' : 'text-green-400';
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function monthsSince(d: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / (30 * 24 * 60 * 60 * 1000));
}
function fmtEur(n: number | null) {
  if (n == null) return '—';
  return n.toLocaleString('fr-BE') + ' €';
}

// ─── sub-components ───────────────────────────────────────────────────────────

function RiskBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-zinc-700 text-xs">—</span>;
  const w = `${score}%`;
  const bg = score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 bg-zinc-800 rounded-full h-1.5 overflow-hidden flex-shrink-0">
        <div className={`h-1.5 rounded-full ${bg}`} style={{ width: w }} />
      </div>
      <span className={`text-xs ${riskColor(score)}`}>{score}</span>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
    >
      {copied ? '✓ Copié !' : 'Copier'}
    </button>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
const inputCls = 'w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 placeholder-zinc-600';
const textareaCls = 'w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 placeholder-zinc-600 resize-y';

// ─── main component ───────────────────────────────────────────────────────────

export default function GarantieClient() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Record<number, string>>({});
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  const [sending, setSending] = useState<number | null>(null);
  const [sendFeedback, setSendFeedback] = useState<Record<number, string>>({});
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState<Record<number, string>>({});
  const [savingNotes, setSavingNotes] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [form, setForm] = useState(BLANK_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/garantie/dossiers');
    const data = await res.json();
    setDossiers(data.dossiers ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.vehicleMake || !form.vehicleModel || !form.customerName || !form.claimDescription) {
      setFormError('Marque, modèle, nom client et description réclamation sont obligatoires.');
      return;
    }
    setFormError(null);
    setCreating(true);
    const body: Record<string, unknown> = {
      vehicleMake: form.vehicleMake, vehicleModel: form.vehicleModel,
      vehicleYear: form.vehicleYear ? Number(form.vehicleYear) : null,
      vehicleVin: form.vehicleVin || null,
      vehicleKmAtSale: form.vehicleKmAtSale ? Number(form.vehicleKmAtSale) : null,
      vehicleKmNow: form.vehicleKmNow ? Number(form.vehicleKmNow) : null,
      saleDate: form.saleDate || null,
      invoiceNumber: form.invoiceNumber || null,
      warrantyDurationMonths: Number(form.warrantyDurationMonths),
      customerName: form.customerName, customerPhone: form.customerPhone || null,
      customerEmail: form.customerEmail || null,
      claimDescription: form.claimDescription, symptoms: form.symptoms || null,
      repairsAlreadyDone: form.repairsAlreadyDone || null,
      usageType: form.usageType, maintenanceOk: form.maintenanceOk,
      internalNotes: form.internalNotes || null,
    };
    const res = await fetch('/api/garantie/dossiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    setCreating(false);
    if (data.dossier) {
      setShowForm(false);
      setForm(BLANK_FORM);
      await load();
      setExpandedId(data.dossier.id);
    }
  };

  const handleAnalyze = async (dossierId: number) => {
    setAnalyzing(dossierId);
    const res = await fetch('/api/garantie/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dossierId }) });
    const data = await res.json();
    setAnalyzing(null);
    if (data.ok) {
      await load();
      setActiveTab(t => ({ ...t, [dossierId]: 'analyse' }));
    } else {
      alert(data.error ?? 'Erreur lors de l\'analyse.');
    }
  };

  const handleSendEmail = async (dossierId: number, type: string) => {
    setSending(dossierId);
    const res = await fetch('/api/garantie/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dossierId, type }) });
    const data = await res.json();
    setSending(null);
    setSendFeedback(f => ({ ...f, [dossierId]: data.ok ? `✓ Envoyé à ${data.sentTo}` : `✗ ${data.error}` }));
    setTimeout(() => setSendFeedback(f => { const n = {...f}; delete n[dossierId]; return n; }), 5000);
  };

  const handleStatusUpdate = async (dossierId: number, status: string) => {
    setUpdatingStatus(dossierId);
    await fetch('/api/garantie/dossiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id: dossierId, status }) });
    setUpdatingStatus(null);
    await load();
  };

  const handleSaveNotes = async (dossierId: number) => {
    setSavingNotes(dossierId);
    await fetch('/api/garantie/dossiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id: dossierId, internalNotes: editNotes[dossierId] ?? '' }) });
    setSavingNotes(null);
    await load();
  };

  const filtered = filter === 'all' ? dossiers
    : filter === 'actifs' ? dossiers.filter(d => ['nouveau','en_analyse','decision_prise','sav_en_cours'].includes(d.status ?? ''))
    : filter === 'litiges' ? dossiers.filter(d => ['litige','expertise','procedure'].includes(d.status ?? ''))
    : dossiers.filter(d => d.status === filter);

  const stats = {
    total: dossiers.length,
    actifs: dossiers.filter(d => ['nouveau','en_analyse','decision_prise','sav_en_cours'].includes(d.status ?? '')).length,
    litiges: dossiers.filter(d => ['litige','expertise','procedure'].includes(d.status ?? '')).length,
    resolus: dossiers.filter(d => d.status === 'resolu').length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Garantie — Agent SAV & Litiges</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Droit belge · Analyse IA · Communications automatiques</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 bg-zinc-100 text-zinc-900 text-sm font-semibold rounded-lg hover:bg-white transition-colors self-start sm:self-auto"
        >
          {showForm ? '✕ Annuler' : '+ Nouveau dossier'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: '' },
          { label: 'Actifs', value: stats.actifs, color: 'text-blue-300' },
          { label: 'Litiges', value: stats.litiges, color: stats.litiges > 0 ? 'text-red-400' : '' },
          { label: 'Résolus', value: stats.resolus, color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className={`text-2xl font-bold ${s.color || 'text-zinc-100'}`}>{s.value}</div>
            <div className="text-xs text-zinc-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* New dossier form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300">Nouveau dossier de garantie</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <FieldGroup label="Marque *">
              <input className={inputCls} placeholder="Volkswagen" value={form.vehicleMake} onChange={e => setField('vehicleMake', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="Modèle *">
              <input className={inputCls} placeholder="Golf" value={form.vehicleModel} onChange={e => setField('vehicleModel', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="Année">
              <input className={inputCls} type="number" placeholder="2020" value={form.vehicleYear} onChange={e => setField('vehicleYear', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="VIN">
              <input className={inputCls} placeholder="VF1..." value={form.vehicleVin} onChange={e => setField('vehicleVin', e.target.value)} />
            </FieldGroup>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <FieldGroup label="Km à la vente">
              <input className={inputCls} type="number" placeholder="85000" value={form.vehicleKmAtSale} onChange={e => setField('vehicleKmAtSale', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="Km actuels">
              <input className={inputCls} type="number" placeholder="93000" value={form.vehicleKmNow} onChange={e => setField('vehicleKmNow', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="Date de vente">
              <input className={inputCls} type="date" value={form.saleDate} onChange={e => setField('saleDate', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="N° facture">
              <input className={inputCls} placeholder="FAC-2024-001" value={form.invoiceNumber} onChange={e => setField('invoiceNumber', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="Garantie">
              <select className={inputCls} value={form.warrantyDurationMonths} onChange={e => setField('warrantyDurationMonths', e.target.value)}>
                <option value="6">6 mois</option>
                <option value="12">12 mois</option>
                <option value="24">24 mois</option>
              </select>
            </FieldGroup>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FieldGroup label="Nom client *">
              <input className={inputCls} placeholder="Martin Dupont" value={form.customerName} onChange={e => setField('customerName', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="Téléphone">
              <input className={inputCls} placeholder="0471 12 34 56" value={form.customerPhone} onChange={e => setField('customerPhone', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="Email client">
              <input className={inputCls} type="email" placeholder="client@email.be" value={form.customerEmail} onChange={e => setField('customerEmail', e.target.value)} />
            </FieldGroup>
          </div>
          <FieldGroup label="Description de la réclamation *">
            <textarea className={textareaCls} rows={3} placeholder="Le client signale que..." value={form.claimDescription} onChange={e => setField('claimDescription', e.target.value)} />
          </FieldGroup>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldGroup label="Symptômes techniques">
              <textarea className={textareaCls} rows={2} placeholder="Bruit sourd au démarrage, témoin..." value={form.symptoms} onChange={e => setField('symptoms', e.target.value)} />
            </FieldGroup>
            <FieldGroup label="Réparations déjà effectuées">
              <textarea className={textareaCls} rows={2} placeholder="Aucune / Déjà fait chez..." value={form.repairsAlreadyDone} onChange={e => setField('repairsAlreadyDone', e.target.value)} />
            </FieldGroup>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <FieldGroup label="Type d'utilisation">
              <select className={inputCls} value={form.usageType} onChange={e => setField('usageType', e.target.value)}>
                <option value="normale">Normale</option>
                <option value="intensive">Intensive / professionnelle</option>
                <option value="modifie">Véhicule modifié</option>
                <option value="negligence">Négligence d'entretien</option>
              </select>
            </FieldGroup>
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" id="maintenanceOk" checked={form.maintenanceOk} onChange={e => setField('maintenanceOk', e.target.checked)} className="w-4 h-4 accent-zinc-400" />
              <label htmlFor="maintenanceOk" className="text-sm text-zinc-300">Entretien conforme</label>
            </div>
          </div>
          <FieldGroup label="Notes internes (non partagées)">
            <textarea className={textareaCls} rows={2} placeholder="Contexte interne, historique client..." value={form.internalNotes} onChange={e => setField('internalNotes', e.target.value)} />
          </FieldGroup>
          {formError && <p className="text-red-400 text-sm">{formError}</p>}
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating} className="px-5 py-2 bg-zinc-100 text-zinc-900 text-sm font-semibold rounded-lg hover:bg-white disabled:opacity-50 transition-colors">
              {creating ? 'Création...' : 'Créer le dossier'}
            </button>
            <button onClick={() => { setShowForm(false); setFormError(null); }} className="px-5 py-2 bg-zinc-800 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-zinc-800 pb-px">
        {[
          { key: 'all', label: `Tous (${dossiers.length})` },
          { key: 'actifs', label: `Actifs (${stats.actifs})` },
          { key: 'litiges', label: `Litiges (${stats.litiges})` },
          { key: 'resolu', label: `Résolus (${stats.resolus})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-sm whitespace-nowrap rounded-t-md transition-colors ${filter === f.key ? 'bg-zinc-900 text-zinc-100 border-b-2 border-white -mb-px' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Dossiers list */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
          {dossiers.length === 0 ? 'Aucun dossier. Cliquez "Nouveau dossier" pour commencer.' : 'Aucun dossier dans cette catégorie.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => {
            const isExpanded = expandedId === d.id;
            const tab = activeTab[d.id] ?? 'analyse';
            const months = monthsSince(d.saleDate);
            const inWarranty = months != null && months <= (d.warrantyDurationMonths ?? 12);
            const inPresumption = months != null && months <= 6;
            const isAnalyzed = !!d.aiAnalysis;
            const isAnalyzing = analyzing === d.id;

            return (
              <div key={d.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                {/* Summary row */}
                <button
                  className="w-full text-left px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : d.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-zinc-200 text-sm">
                        {d.vehicleMake} {d.vehicleModel} {d.vehicleYear ? `(${d.vehicleYear})` : ''}
                      </span>
                      {d.category && (
                        <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">Cat. {d.category}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[d.status ?? 'nouveau']}`}>
                        {STATUS_LABELS[d.status ?? 'nouveau']}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {d.customerName} · Réclamation le {fmtDate(d.claimDate)}
                      {inPresumption ? ' · ' : ' · '}
                      <span className={inPresumption ? 'text-amber-400' : inWarranty ? 'text-green-400' : 'text-zinc-600'}>
                        {inPresumption ? '⚠ Présomption active' : inWarranty ? '✓ Garantie en cours' : 'Hors garantie'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {d.coverageDecision && (
                      <span className={`text-sm font-medium hidden sm:inline ${COVERAGE_COLORS[d.coverageDecision]}`}>
                        {COVERAGE_LABELS[d.coverageDecision]}
                      </span>
                    )}
                    <div className="hidden sm:flex flex-col gap-1">
                      <RiskBar score={d.riskScoreLegal} />
                      <RiskBar score={d.litigationProbability} />
                    </div>
                    <span className="text-zinc-600 text-lg">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 p-4 space-y-4">
                    {/* Analyze button */}
                    {!isAnalyzed && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleAnalyze(d.id)}
                          disabled={isAnalyzing}
                          className="px-4 py-2 bg-blue-900 border border-blue-700 text-blue-300 text-sm rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors"
                        >
                          {isAnalyzing ? '⏳ Analyse en cours (20-30s)...' : '⚡ Analyser avec l\'IA'}
                        </button>
                        {isAnalyzing && (
                          <span className="text-xs text-zinc-500">Claude analyse le dossier en droit belge...</span>
                        )}
                      </div>
                    )}

                    {/* Re-analyze button if already analyzed */}
                    {isAnalyzed && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAnalyze(d.id)}
                          disabled={isAnalyzing}
                          className="px-3 py-1 text-xs bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 disabled:opacity-60 transition-colors"
                        >
                          {isAnalyzing ? '⏳ Ré-analyse...' : '↺ Ré-analyser'}
                        </button>
                        <span className="text-xs text-zinc-600">Confiance : {d.confidenceLevel ?? '—'}%</span>
                      </div>
                    )}

                    {/* Tabs */}
                    {isAnalyzed && (
                      <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto scrollbar-none">
                        {[
                          { key: 'analyse', label: 'Analyse' },
                          { key: 'email', label: 'Email client', hidden: !d.communicationEmail },
                          { key: 'whatsapp', label: 'WhatsApp', hidden: !d.communicationWhatsapp },
                          { key: 'refus', label: 'Lettre refus', hidden: !d.communicationRefus },
                          { key: 'transaction', label: 'Transaction', hidden: !d.communicationTransaction },
                          { key: 'litige', label: '⚠ Litige', hidden: !d.litigationPackage },
                          { key: 'actions', label: 'Actions' },
                        ].filter(t => !t.hidden).map(t => (
                          <button
                            key={t.key}
                            onClick={() => setActiveTab(a => ({ ...a, [d.id]: t.key }))}
                            className={`px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${tab === t.key ? 'text-zinc-100 border-b-2 border-white -mb-px' : 'text-zinc-500 hover:text-zinc-300'}`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Tab: Analyse */}
                    {isAnalyzed && tab === 'analyse' && (
                      <div className="space-y-3 text-sm">
                        <div className="flex flex-wrap gap-3">
                          {d.category && (
                            <div className="bg-zinc-800 rounded-lg px-3 py-2">
                              <div className="text-xs text-zinc-500">Catégorie</div>
                              <div className="text-zinc-200 font-semibold">{d.category} — {CAT_LABELS[d.category]}</div>
                            </div>
                          )}
                          <div className="bg-zinc-800 rounded-lg px-3 py-2">
                            <div className="text-xs text-zinc-500">Décision</div>
                            <div className={`font-semibold ${COVERAGE_COLORS[d.coverageDecision ?? 'en_attente']}`}>
                              {COVERAGE_LABELS[d.coverageDecision ?? 'en_attente']}
                              {d.coveragePercent != null && ` (${d.coveragePercent}%)`}
                            </div>
                            {d.clientContribution != null && (
                              <div className="text-xs text-zinc-500 mt-0.5">Participation client : {fmtEur(d.clientContribution)}</div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { label: 'Risque juridique', v: d.riskScoreLegal },
                            { label: 'Risque financier', v: d.riskScoreFinancial },
                            { label: 'Prob. litige', v: d.litigationProbability },
                            { label: 'Succès garage', v: d.garageSuccessProbability },
                          ].map(r => (
                            <div key={r.label} className="bg-zinc-800 rounded-lg p-2">
                              <div className="text-xs text-zinc-500 mb-1">{r.label}</div>
                              <RiskBar score={r.v} />
                            </div>
                          ))}
                        </div>
                        {d.aiAnalysis && (
                          <div className="bg-zinc-800 rounded-lg p-3">
                            <div className="text-xs text-zinc-500 mb-1.5">Analyse juridique</div>
                            <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap">{d.aiAnalysis}</p>
                          </div>
                        )}
                        {d.aiRecommendation && (
                          <div className="bg-blue-950 border border-blue-900 rounded-lg p-3">
                            <div className="text-xs text-blue-400 mb-1">Recommandation</div>
                            <p className="text-blue-200 text-sm">{d.aiRecommendation}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {d.aiStrengths && d.aiStrengths.length > 0 && (
                            <div>
                              <div className="text-xs text-green-400 mb-1">✓ Forces du garage</div>
                              <ul className="space-y-0.5">{d.aiStrengths.map((s,i) => <li key={i} className="text-xs text-zinc-400">· {s}</li>)}</ul>
                            </div>
                          )}
                          {d.aiWeaknesses && d.aiWeaknesses.length > 0 && (
                            <div>
                              <div className="text-xs text-red-400 mb-1">✗ Faiblesses</div>
                              <ul className="space-y-0.5">{d.aiWeaknesses.map((s,i) => <li key={i} className="text-xs text-zinc-400">· {s}</li>)}</ul>
                            </div>
                          )}
                        </div>
                        {d.aiNextSteps && d.aiNextSteps.length > 0 && (
                          <div>
                            <div className="text-xs text-amber-400 mb-1">→ Prochaines étapes</div>
                            <ol className="space-y-0.5 list-decimal list-inside">{d.aiNextSteps.map((s,i) => <li key={i} className="text-xs text-zinc-300">{s}</li>)}</ol>
                          </div>
                        )}
                        {d.aiLegalBasis && d.aiLegalBasis.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {d.aiLegalBasis.map((l,i) => <span key={i} className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded">{l}</span>)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab: Communications */}
                    {(['email','whatsapp','refus','transaction'] as const).map(commKey => {
                      const commText = commKey === 'email' ? d.communicationEmail
                        : commKey === 'whatsapp' ? d.communicationWhatsapp
                        : commKey === 'refus' ? d.communicationRefus
                        : d.communicationTransaction;
                      if (tab !== commKey || !commText) return null;
                      return (
                        <div key={commKey} className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <CopyBtn text={commText} />
                            {(commKey === 'email' || commKey === 'refus' || commKey === 'transaction') && d.customerEmail && (
                              <button
                                onClick={() => handleSendEmail(d.id, commKey)}
                                disabled={sending === d.id}
                                className="px-3 py-1 text-xs bg-green-900 border border-green-800 text-green-300 rounded hover:bg-green-800 disabled:opacity-60 transition-colors"
                              >
                                {sending === d.id ? 'Envoi...' : `✉ Envoyer à ${d.customerEmail}`}
                              </button>
                            )}
                            {commKey === 'whatsapp' && d.customerPhone && (
                              <span className="text-xs text-zinc-500">Copier puis coller dans WhatsApp ({d.customerPhone})</span>
                            )}
                            {sendFeedback[d.id] && (
                              <span className={`text-xs ${sendFeedback[d.id].startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                                {sendFeedback[d.id]}
                              </span>
                            )}
                          </div>
                          <pre className="bg-zinc-800 rounded-lg p-3 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-64 overflow-y-auto">
                            {commText}
                          </pre>
                        </div>
                      );
                    })}

                    {/* Tab: Litige package */}
                    {tab === 'litige' && d.litigationPackage && (
                      <div className="space-y-3 text-sm">
                        <div className="bg-red-950 border border-red-900 rounded-lg p-3">
                          <div className="text-red-300 font-semibold mb-1">Package Litige — GP-CARS</div>
                          <div className="text-xs text-red-400 mb-3">Document à transmettre à votre conseil juridique</div>
                          {Object.entries(d.litigationPackage).map(([k, v]) => (
                            <div key={k} className="mb-2">
                              <div className="text-xs text-zinc-500 capitalize">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</div>
                              <div className="text-xs text-zinc-300 mt-0.5">
                                {typeof v === 'string' ? v : typeof v === 'number' ? `${v.toLocaleString('fr-BE')} €` : Array.isArray(v) ? v.join(', ') : JSON.stringify(v)}
                              </div>
                            </div>
                          ))}
                        </div>
                        <CopyBtn text={JSON.stringify(d.litigationPackage, null, 2)} />
                      </div>
                    )}

                    {/* Tab: Actions */}
                    {(!isAnalyzed || tab === 'actions') && (
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-zinc-500 mb-1.5">Statut du dossier</div>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_STATUSES.map(s => (
                              <button
                                key={s}
                                onClick={() => handleStatusUpdate(d.id, s)}
                                disabled={updatingStatus === d.id || d.status === s}
                                className={`px-2.5 py-1 text-xs rounded border transition-colors ${d.status === s ? STATUS_COLORS[s] : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'} disabled:opacity-50`}
                              >
                                {STATUS_LABELS[s]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500 mb-1.5">Notes internes</div>
                          <textarea
                            className={textareaCls}
                            rows={3}
                            defaultValue={d.internalNotes ?? ''}
                            onChange={e => setEditNotes(n => ({ ...n, [d.id]: e.target.value }))}
                            placeholder="Notes confidentielles sur ce dossier..."
                          />
                          <button
                            onClick={() => handleSaveNotes(d.id)}
                            disabled={savingNotes === d.id}
                            className="mt-1.5 px-3 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 disabled:opacity-60 transition-colors"
                          >
                            {savingNotes === d.id ? 'Sauvegarde...' : 'Sauvegarder notes'}
                          </button>
                        </div>
                        <div className="text-xs text-zinc-600">
                          Dossier #{d.id} · Créé le {fmtDate(d.createdAt)}
                          {d.vehicleVin && ` · VIN : ${d.vehicleVin}`}
                          {d.invoiceNumber && ` · Facture : ${d.invoiceNumber}`}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
