'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OpportuniteUI {
  id: number;
  source?: string | null;
  listingUrl?: string | null;
  make?: string | null;
  model?: string | null;
  version?: string | null;
  year?: number | null;
  km?: number | null;
  fuel?: string | null;
  askingPrice?: number | null;
  location?: string | null;
  sellerName?: string | null;
  sellerPhone?: string | null;
  sellerType?: string | null;
  scoreMandat?: number | null;
  scoreSignature?: number | null;
  scoreRentabilite?: number | null;
  priorite?: string | null;
  urgenceNiveau?: string | null;
  urgenceSignaux?: string[] | null;
  prixRapide?: number | null;
  prixMarche?: number | null;
  prixOptimise?: number | null;
  commissionNette?: number | null;
  rentabilite?: string | null;
  analyse?: string | null;
  forces?: string[] | null;
  faiblesses?: string[] | null;
  risques?: string[] | null;
  scriptSms?: string | null;
  scriptWhatsapp?: string | null;
  scriptEmail?: string | null;
  scriptMessenger?: string | null;
  scriptTelephone?: Record<string, string> | null;
  objections?: Array<{ objection: string; reponse: string; strategie: string }> | null;
  relancesProgrammees?: Array<{ declencheur: string; canal: string; message: string }> | null;
  nextSteps?: string[] | null;
  status?: string | null;
  proDeguise?: boolean | null;
  confidenceLevel?: number | null;
  createdAt?: string | null;
  internalNotes?: string | null;
}

interface StatsUI {
  total: number;
  nouveaux: number;
  contactes: number;
  rdv: number;
  mandatsSigmes: number;
  perdus: number;
  prioriteA: number;
  commissionEstimee: number;
  commissionRealisee: number;
  tauxConversion: number;
}

type FilterType = 'tous' | 'nouveau' | 'contacte' | 'rdv' | 'mandat' | 'perdu';

// ─── Helper components ────────────────────────────────────────────────────────

function CopyBtn({ text, label = '📋 Copier' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition-colors"
    >
      {copied ? '✓ Copié!' : label}
    </button>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number | null | undefined; color: string }) {
  const v = value ?? 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className={`font-semibold ${color}`}>{v}/100</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full">
        <div
          className={`h-1.5 rounded-full ${color.replace('text-', 'bg-')}`}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

function PrioriteBadge({ p }: { p: string | null | undefined }) {
  const cfg: Record<string, string> = {
    A: 'bg-orange-950 border-orange-700 text-orange-300',
    B: 'bg-blue-950 border-blue-700 text-blue-300',
    C: 'bg-zinc-800 border-zinc-600 text-zinc-400',
    rejet: 'bg-red-950 border-red-800 text-red-400',
  };
  if (!p) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-bold ${cfg[p] ?? cfg.C}`}>
      P{p}
    </span>
  );
}

function UrgenceBadge({ niveau }: { niveau: string | null | undefined }) {
  const cfg: Record<string, string> = {
    faible: 'bg-zinc-800 text-zinc-400',
    moyenne: 'bg-yellow-950 text-yellow-300',
    forte: 'bg-orange-950 text-orange-300',
    tres_forte: 'bg-red-950 text-red-300',
  };
  const labels: Record<string, string> = {
    faible: 'Urgence faible',
    moyenne: 'Urgence moyenne',
    forte: 'Urgence forte',
    tres_forte: 'Urgence très forte',
  };
  if (!niveau) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${cfg[niveau] ?? cfg.faible}`}>
      {labels[niveau] ?? niveau}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const cfg: Record<string, string> = {
    nouveau: 'bg-zinc-800 text-zinc-300',
    contacte: 'bg-blue-950 text-blue-300',
    rdv: 'bg-purple-950 text-purple-300',
    mandat: 'bg-green-950 text-green-300',
    perdu: 'bg-red-950 text-red-400',
    rejete: 'bg-red-950 text-red-500',
  };
  const labels: Record<string, string> = {
    nouveau: 'Nouveau',
    contacte: 'Contacté',
    rdv: 'RDV',
    mandat: 'Mandat signé',
    perdu: 'Perdu',
    rejete: 'Rejeté',
  };
  if (!status) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${cfg[status] ?? cfg.nouveau}`}>
      {labels[status] ?? status}
    </span>
  );
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('fr-BE') + ' €';
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MandatsClient() {
  const [opps, setOpps] = useState<OpportuniteUI[]>([]);
  const [stats, setStats] = useState<StatsUI | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Record<number, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<FilterType>('tous');
  const [urlForm, setUrlForm] = useState('');
  const [analyzingUrl, setAnalyzingUrl] = useState(false);
  const [form, setForm] = useState({
    source: 'autoscout24',
    listingUrl: '',
    make: '',
    model: '',
    year: '',
    km: '',
    fuel: '',
    gearbox: '',
    askingPrice: '',
    location: '',
    sellerName: '',
    sellerPhone: '',
    listingDescription: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [savingNotes, setSavingNotes] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState<Record<number, { canal: string; message: string; reponse: string; resultat: string }>>({});
  const [savingContact, setSavingContact] = useState<number | null>(null);
  const [expandedObjection, setExpandedObjection] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [oppsRes, statsRes] = await Promise.all([
        fetch('/api/mandats/opportunites'),
        fetch('/api/mandats/stats'),
      ]);
      const oppsData = await oppsRes.json();
      const statsData = await statsRes.json();
      setOpps(oppsData.opportunites ?? []);
      setStats(statsData.stats ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'tous' ? opps : opps.filter(o => o.status === filter);

  const handleAnalyze = async (opp: OpportuniteUI) => {
    setAnalyzing(opp.id);
    setActiveTab(prev => ({ ...prev, [opp.id]: 'analyse' }));
    try {
      const res = await fetch('/api/mandats/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportuniteId: opp.id }),
      });
      if (res.ok) {
        await load();
        setExpandedId(opp.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleAnalyzeUrl = async () => {
    if (!urlForm.trim()) return;
    setAnalyzingUrl(true);
    try {
      const res = await fetch('/api/mandats/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlForm.trim(), source: 'url_directe' }),
      });
      if (res.ok) {
        const data = await res.json();
        setUrlForm('');
        await load();
        if (data.opportuniteId) {
          setExpandedId(data.opportuniteId);
          setActiveTab(prev => ({ ...prev, [data.opportuniteId]: 'analyse' }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzingUrl(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch('/api/mandats/opportunites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: form.source || 'manuel',
          listingUrl: form.listingUrl || null,
          make: form.make || null,
          model: form.model || null,
          year: form.year ? Number(form.year) : null,
          km: form.km ? Number(form.km) : null,
          fuel: form.fuel || null,
          gearbox: form.gearbox || null,
          askingPrice: form.askingPrice ? Number(form.askingPrice) : null,
          location: form.location || null,
          sellerName: form.sellerName || null,
          sellerPhone: form.sellerPhone || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.opportunite) {
        setShowForm(false);
        await load();
        // Auto-analyze if we have enough info
        if (data.opportunite.id && (form.listingUrl || form.make)) {
          setExpandedId(data.opportunite.id);
          await handleAnalyze(data.opportunite);
        }
      } else {
        setFormError(data.error ?? 'Erreur lors de la création.');
      }
    } catch (e) {
      setFormError('Erreur réseau.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    await fetch('/api/mandats/opportunites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_status', id, status }),
    });
    await load();
  };

  const handleSaveNotes = async (id: number) => {
    setSavingNotes(id);
    await fetch('/api/mandats/opportunites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_notes', id, notes: notes[id] ?? '' }),
    });
    setSavingNotes(null);
  };

  const handleAddContact = async (id: number) => {
    const cf = contactForm[id];
    if (!cf?.canal) return;
    setSavingContact(id);
    await fetch('/api/mandats/opportunites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_contact',
        opportuniteId: id,
        canal: cf.canal,
        messageEnvoye: cf.message || null,
        reponseObtenue: cf.reponse || null,
        resultat: cf.resultat || null,
      }),
    });
    setSavingContact(null);
    setContactForm(prev => ({ ...prev, [id]: { canal: '', message: '', reponse: '', resultat: '' } }));
    await load();
  };

  const getTab = (id: number) => activeTab[id] ?? 'analyse';
  const setTab = (id: number, tab: string) => setActiveTab(prev => ({ ...prev, [id]: tab }));

  const TABS = ['analyse', 'sms', 'whatsapp', 'email', 'telephone', 'objections', 'relances', 'actions'];
  const TAB_LABELS: Record<string, string> = {
    analyse: 'Analyse',
    sms: 'SMS',
    whatsapp: 'WhatsApp',
    email: 'Email',
    telephone: 'Téléphone',
    objections: 'Objections',
    relances: 'Relances',
    actions: 'Actions',
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Mandats — Agent Acquisition VO</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Acquisition de mandats dépôt-vente · v1.0</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-md transition-colors"
        >
          ➕ Nouvelle opportunité
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { label: 'Total', value: stats.total, sub: '' },
            { label: 'Priorité A', value: stats.prioriteA, sub: 'orange', cls: 'text-orange-400' },
            { label: 'Contactés', value: stats.contactes, sub: '' },
            { label: 'RDV', value: stats.rdv, sub: '', cls: 'text-purple-400' },
            { label: 'Mandats', value: stats.mandatsSigmes, sub: '', cls: 'text-green-400' },
            { label: 'Commission est.', value: null, raw: fmt(stats.commissionEstimee), cls: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <div className={`text-xl font-bold ${s.cls ?? 'text-zinc-100'}`}>
                {s.raw ?? s.value}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick analyze by URL */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2">
        <div className="text-sm font-medium text-zinc-300">Analyser une annonce par URL</div>
        <div className="flex gap-2">
          <input
            type="url"
            value={urlForm}
            onChange={e => setUrlForm(e.target.value)}
            placeholder="https://www.autoscout24.be/fr/annonce/..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500"
            onKeyDown={e => e.key === 'Enter' && handleAnalyzeUrl()}
          />
          <button
            onClick={handleAnalyzeUrl}
            disabled={analyzingUrl || !urlForm.trim()}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm rounded transition-colors whitespace-nowrap"
          >
            {analyzingUrl ? 'Analyse...' : 'Analyser'}
          </button>
        </div>
        {analyzingUrl && (
          <p className="text-xs text-zinc-400 animate-pulse">Analyse en cours... (20-30s)</p>
        )}
      </div>

      {/* New opportunity form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200">Nouvelle opportunité manuelle</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { key: 'source', label: 'Source', placeholder: 'autoscout24, 2ememain...' },
              { key: 'listingUrl', label: "URL de l'annonce", placeholder: 'https://...' },
              { key: 'make', label: 'Marque', placeholder: 'Volkswagen' },
              { key: 'model', label: 'Modèle', placeholder: 'Golf' },
              { key: 'year', label: 'Année', placeholder: '2019' },
              { key: 'km', label: 'Kilométrage', placeholder: '75000' },
              { key: 'fuel', label: 'Carburant', placeholder: 'Essence, Diesel...' },
              { key: 'gearbox', label: 'Boîte', placeholder: 'Manuelle, Automatique' },
              { key: 'askingPrice', label: 'Prix demandé (€)', placeholder: '12500' },
              { key: 'location', label: 'Localisation', placeholder: 'Bruxelles' },
              { key: 'sellerName', label: 'Nom vendeur', placeholder: 'Jean Dupont' },
              { key: 'sellerPhone', label: 'Téléphone vendeur', placeholder: '+32 470...' },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs text-zinc-400">{f.label}</label>
                <input
                  type="text"
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500"
                />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Description de l'annonce (optionnel)</label>
            <textarea
              value={form.listingDescription}
              onChange={e => setForm(prev => ({ ...prev, listingDescription: e.target.value }))}
              rows={3}
              placeholder="Copiez/collez la description de l'annonce..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500"
            />
          </div>
          {formError && <p className="text-red-400 text-xs">{formError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
            >
              {creating ? 'Création...' : 'Créer et analyser'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-zinc-800 pb-px overflow-x-auto scrollbar-none">
        {(['tous', 'nouveau', 'contacte', 'rdv', 'mandat', 'perdu'] as FilterType[]).map(f => {
          const count = f === 'tous' ? opps.length : opps.filter(o => o.status === f).length;
          const labels: Record<FilterType, string> = {
            tous: 'Tous',
            nouveau: 'Nouveau',
            contacte: 'Contacté',
            rdv: 'RDV',
            mandat: 'Mandat signé',
            perdu: 'Perdu',
          };
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-sm rounded-t-md transition-colors whitespace-nowrap flex-shrink-0 ${
                filter === f
                  ? 'bg-zinc-900 text-zinc-100 border-b-2 border-orange-500 -mb-px'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {labels[f]} <span className="text-xs opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Opportunity list */}
      {loading ? (
        <div className="text-zinc-500 text-sm text-center py-8">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-zinc-600 text-sm text-center py-8">
          Aucune opportunité. Analysez une annonce ou créez-en une manuellement.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(opp => {
            const isExpanded = expandedId === opp.id;
            const tab = getTab(opp.id);
            const isAnalyzing = analyzing === opp.id;
            const hasAnalysis = opp.scoreMandat != null;

            return (
              <div
                key={opp.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
              >
                {/* Card header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : opp.id)}
                >
                  <PrioriteBadge p={opp.priorite} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-zinc-100">
                        {opp.make ?? '?'} {opp.model ?? '?'} {opp.year ?? ''}
                      </span>
                      {opp.km != null && (
                        <span className="text-zinc-500 text-sm">{opp.km.toLocaleString('fr-BE')} km</span>
                      )}
                      {opp.askingPrice != null && (
                        <span className="text-zinc-300 text-sm font-medium">{fmt(opp.askingPrice)}</span>
                      )}
                      {opp.location && (
                        <span className="text-zinc-500 text-xs">{opp.location}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <StatusBadge status={opp.status} />
                      {opp.proDeguise && (
                        <span className="text-xs bg-yellow-950 text-yellow-400 px-1.5 py-0.5 rounded">Pro déguisé</span>
                      )}
                      {opp.source && (
                        <span className="text-xs text-zinc-600">{opp.source}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {hasAnalysis && (
                      <div className="text-sm font-semibold text-orange-400">{opp.scoreMandat}/100</div>
                    )}
                    <div className="text-zinc-500 text-xs mt-0.5">{isExpanded ? '▲' : '▼'}</div>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-zinc-800">
                    {/* Tabs */}
                    <div className="flex gap-0.5 px-4 pt-3 overflow-x-auto scrollbar-none">
                      {TABS.map(t => (
                        <button
                          key={t}
                          onClick={() => setTab(opp.id, t)}
                          className={`px-3 py-1.5 text-xs rounded-t-md transition-colors whitespace-nowrap flex-shrink-0 ${
                            tab === t
                              ? 'bg-zinc-800 text-zinc-100'
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {TAB_LABELS[t]}
                        </button>
                      ))}
                    </div>

                    <div className="px-4 pb-4 pt-3 space-y-4">
                      {/* ── Tab: Analyse ── */}
                      {tab === 'analyse' && (
                        <div className="space-y-4">
                          {!hasAnalysis && !isAnalyzing && (
                            <div className="text-center py-6">
                              <p className="text-zinc-500 text-sm mb-3">
                                Cette opportunité n'a pas encore été analysée par l'IA.
                              </p>
                              <button
                                onClick={() => handleAnalyze(opp)}
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded transition-colors"
                              >
                                Analyser cette opportunité
                              </button>
                            </div>
                          )}
                          {isAnalyzing && (
                            <div className="text-center py-6">
                              <div className="text-orange-400 text-sm animate-pulse">
                                Analyse en cours... (20-30 secondes)
                              </div>
                            </div>
                          )}
                          {hasAnalysis && !isAnalyzing && (
                            <>
                              {opp.proDeguise && (
                                <div className="bg-yellow-950 border border-yellow-800 rounded p-3 text-yellow-300 text-sm">
                                  ⚠️ <strong>Professionnel déguisé détecté</strong> — Ce vendeur semble être un professionnel se faisant passer pour un particulier. Vérifiez avant de contacter.
                                </div>
                              )}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <ScoreBar label="Score Mandat" value={opp.scoreMandat} color="text-orange-400" />
                                <ScoreBar label="Score Signature" value={opp.scoreSignature} color="text-blue-400" />
                                <ScoreBar label="Score Rentabilité" value={opp.scoreRentabilite} color="text-emerald-400" />
                              </div>
                              <div className="flex items-center gap-2">
                                <UrgenceBadge niveau={opp.urgenceNiveau} />
                                {(opp.urgenceSignaux ?? []).slice(0, 3).map((s, i) => (
                                  <span key={i} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">{s}</span>
                                ))}
                              </div>
                              {/* Estimation table */}
                              <div className="bg-zinc-800 rounded-lg p-3">
                                <div className="text-xs font-semibold text-zinc-400 mb-2">Estimation</div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                  {[
                                    { label: 'Prix rapide', value: fmt(opp.prixRapide) },
                                    { label: 'Prix marché', value: fmt(opp.prixMarche) },
                                    { label: 'Prix optimisé', value: fmt(opp.prixOptimise), cls: 'text-emerald-400 font-semibold' },
                                    { label: 'Commission nette', value: fmt(opp.commissionNette), cls: 'text-orange-400 font-semibold' },
                                    { label: 'Rentabilité', value: opp.rentabilite ?? '—' },
                                  ].map(row => (
                                    <div key={row.label}>
                                      <div className="text-zinc-500 text-xs">{row.label}</div>
                                      <div className={row.cls ?? 'text-zinc-200'}>{row.value}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {opp.analyse && (
                                <div className="text-sm text-zinc-300 leading-relaxed">{opp.analyse}</div>
                              )}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                {opp.forces && opp.forces.length > 0 && (
                                  <div>
                                    <div className="text-green-400 font-semibold mb-1">Forces</div>
                                    <ul className="space-y-0.5">
                                      {opp.forces.map((f, i) => <li key={i} className="text-zinc-400">✓ {f}</li>)}
                                    </ul>
                                  </div>
                                )}
                                {opp.faiblesses && opp.faiblesses.length > 0 && (
                                  <div>
                                    <div className="text-red-400 font-semibold mb-1">Faiblesses</div>
                                    <ul className="space-y-0.5">
                                      {opp.faiblesses.map((f, i) => <li key={i} className="text-zinc-400">✗ {f}</li>)}
                                    </ul>
                                  </div>
                                )}
                                {opp.risques && opp.risques.length > 0 && (
                                  <div>
                                    <div className="text-orange-400 font-semibold mb-1">Risques</div>
                                    <ul className="space-y-0.5">
                                      {opp.risques.map((r, i) => <li key={i} className="text-zinc-400">⚠ {r}</li>)}
                                    </ul>
                                  </div>
                                )}
                              </div>
                              {opp.nextSteps && opp.nextSteps.length > 0 && (
                                <div>
                                  <div className="text-xs font-semibold text-zinc-400 mb-1">Prochaines étapes</div>
                                  <ol className="text-xs text-zinc-300 space-y-1 list-decimal list-inside">
                                    {opp.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
                                  </ol>
                                </div>
                              )}
                              <button
                                onClick={() => handleAnalyze(opp)}
                                className="text-xs text-zinc-500 hover:text-zinc-300 underline"
                              >
                                Relancer l'analyse
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {/* ── Tab: SMS ── */}
                      {tab === 'sms' && (
                        <div className="space-y-3">
                          {opp.scriptSms ? (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-zinc-500">
                                  {opp.scriptSms.length} / 160 caractères
                                </span>
                                <CopyBtn text={opp.scriptSms} />
                              </div>
                              <div className="bg-zinc-800 rounded p-3 text-sm text-zinc-200 whitespace-pre-wrap">
                                {opp.scriptSms}
                              </div>
                            </>
                          ) : (
                            <NoScript onAnalyze={() => handleAnalyze(opp)} analyzing={isAnalyzing} />
                          )}
                        </div>
                      )}

                      {/* ── Tab: WhatsApp ── */}
                      {tab === 'whatsapp' && (
                        <div className="space-y-3">
                          {opp.scriptWhatsapp ? (
                            <>
                              <div className="flex justify-end"><CopyBtn text={opp.scriptWhatsapp} /></div>
                              <div className="bg-zinc-800 rounded p-3 text-sm text-zinc-200 whitespace-pre-wrap">
                                {opp.scriptWhatsapp}
                              </div>
                            </>
                          ) : (
                            <NoScript onAnalyze={() => handleAnalyze(opp)} analyzing={isAnalyzing} />
                          )}
                        </div>
                      )}

                      {/* ── Tab: Email ── */}
                      {tab === 'email' && (
                        <div className="space-y-3">
                          {opp.scriptEmail ? (
                            <>
                              <div className="flex justify-end"><CopyBtn text={opp.scriptEmail} /></div>
                              <div className="bg-zinc-800 rounded p-3 text-sm text-zinc-200 whitespace-pre-wrap font-mono">
                                {opp.scriptEmail}
                              </div>
                            </>
                          ) : (
                            <NoScript onAnalyze={() => handleAnalyze(opp)} analyzing={isAnalyzing} />
                          )}
                        </div>
                      )}

                      {/* ── Tab: Messenger ── */}
                      {tab === 'messenger' && (
                        <div className="space-y-3">
                          {opp.scriptMessenger ? (
                            <>
                              <div className="flex justify-end"><CopyBtn text={opp.scriptMessenger} /></div>
                              <div className="bg-zinc-800 rounded p-3 text-sm text-zinc-200 whitespace-pre-wrap">
                                {opp.scriptMessenger}
                              </div>
                            </>
                          ) : (
                            <NoScript onAnalyze={() => handleAnalyze(opp)} analyzing={isAnalyzing} />
                          )}
                        </div>
                      )}

                      {/* ── Tab: Téléphone ── */}
                      {tab === 'telephone' && (
                        <div className="space-y-3">
                          {opp.scriptTelephone ? (
                            <>
                              {Object.entries(opp.scriptTelephone).map(([key, text]) => {
                                const labels: Record<string, string> = {
                                  introduction: '1. Introduction',
                                  decouverte: '2. Découverte',
                                  argumentation: '3. Argumentation',
                                  conclusion: '4. Conclusion',
                                  prise_rdv: '5. Prise de RDV',
                                };
                                return (
                                  <div key={key} className="bg-zinc-800 rounded p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold text-orange-400">
                                        {labels[key] ?? key}
                                      </span>
                                      <CopyBtn text={text} />
                                    </div>
                                    <p className="text-sm text-zinc-300 whitespace-pre-wrap">{text}</p>
                                  </div>
                                );
                              })}
                            </>
                          ) : (
                            <NoScript onAnalyze={() => handleAnalyze(opp)} analyzing={isAnalyzing} />
                          )}
                        </div>
                      )}

                      {/* ── Tab: Objections ── */}
                      {tab === 'objections' && (
                        <div className="space-y-2">
                          {opp.objections && opp.objections.length > 0 ? (
                            opp.objections.map((obj, i) => {
                              const key = `${opp.id}-${i}`;
                              const isOpen = expandedObjection[key];
                              return (
                                <div key={i} className="bg-zinc-800 rounded-lg overflow-hidden">
                                  <button
                                    className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-zinc-700/50 transition-colors"
                                    onClick={() => setExpandedObjection(prev => ({ ...prev, [key]: !isOpen }))}
                                  >
                                    <span className="text-sm text-zinc-200 font-medium">"{obj.objection}"</span>
                                    <span className="text-zinc-500 text-xs">{isOpen ? '▲' : '▼'}</span>
                                  </button>
                                  {isOpen && (
                                    <div className="px-4 pb-3 space-y-2 border-t border-zinc-700">
                                      <div className="mt-2">
                                        <div className="text-xs text-zinc-500 mb-1">Réponse</div>
                                        <p className="text-sm text-zinc-300">{obj.reponse}</p>
                                      </div>
                                      <div>
                                        <div className="text-xs text-zinc-500 mb-1">Stratégie</div>
                                        <p className="text-xs text-zinc-400 italic">{obj.strategie}</p>
                                      </div>
                                      <CopyBtn text={obj.reponse} label="📋 Copier la réponse" />
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <NoScript onAnalyze={() => handleAnalyze(opp)} analyzing={isAnalyzing} />
                          )}
                        </div>
                      )}

                      {/* ── Tab: Relances ── */}
                      {tab === 'relances' && (
                        <div className="space-y-4">
                          {opp.relancesProgrammees && opp.relancesProgrammees.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-zinc-400 mb-2">Relances planifiées</div>
                              <div className="space-y-2">
                                {opp.relancesProgrammees.map((r, i) => (
                                  <div key={i} className="bg-zinc-800 rounded p-3 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-orange-400">{r.declencheur}</span>
                                      <span className="text-xs bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">{r.canal}</span>
                                    </div>
                                    <p className="text-xs text-zinc-300">{r.message}</p>
                                    <CopyBtn text={r.message} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Enregistrer contact */}
                          <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
                            <div className="text-xs font-semibold text-zinc-300">Enregistrer un contact</div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-zinc-500">Canal</label>
                                <select
                                  value={contactForm[opp.id]?.canal ?? ''}
                                  onChange={e => setContactForm(prev => ({ ...prev, [opp.id]: { ...(prev[opp.id] ?? {}), canal: e.target.value, message: prev[opp.id]?.message ?? '', reponse: prev[opp.id]?.reponse ?? '', resultat: prev[opp.id]?.resultat ?? '' } }))}
                                  className="w-full mt-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100"
                                >
                                  <option value="">Choisir...</option>
                                  <option value="sms">SMS</option>
                                  <option value="whatsapp">WhatsApp</option>
                                  <option value="email">Email</option>
                                  <option value="telephone">Téléphone</option>
                                  <option value="messenger">Messenger</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-zinc-500">Résultat</label>
                                <select
                                  value={contactForm[opp.id]?.resultat ?? ''}
                                  onChange={e => setContactForm(prev => ({ ...prev, [opp.id]: { ...(prev[opp.id] ?? {}), resultat: e.target.value, canal: prev[opp.id]?.canal ?? '', message: prev[opp.id]?.message ?? '', reponse: prev[opp.id]?.reponse ?? '' } }))}
                                  className="w-full mt-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100"
                                >
                                  <option value="">Résultat...</option>
                                  <option value="pas_reponse">Pas de réponse</option>
                                  <option value="interesse">Intéressé</option>
                                  <option value="negatif">Négatif</option>
                                  <option value="rdv_fixe">RDV fixé</option>
                                  <option value="mandat_signe">Mandat signé</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-zinc-500">Message envoyé</label>
                              <textarea
                                value={contactForm[opp.id]?.message ?? ''}
                                onChange={e => setContactForm(prev => ({ ...prev, [opp.id]: { ...(prev[opp.id] ?? {}), message: e.target.value, canal: prev[opp.id]?.canal ?? '', reponse: prev[opp.id]?.reponse ?? '', resultat: prev[opp.id]?.resultat ?? '' } }))}
                                rows={2}
                                className="w-full mt-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-zinc-500">Réponse obtenue</label>
                              <textarea
                                value={contactForm[opp.id]?.reponse ?? ''}
                                onChange={e => setContactForm(prev => ({ ...prev, [opp.id]: { ...(prev[opp.id] ?? {}), reponse: e.target.value, canal: prev[opp.id]?.canal ?? '', message: prev[opp.id]?.message ?? '', resultat: prev[opp.id]?.resultat ?? '' } }))}
                                rows={2}
                                className="w-full mt-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100"
                              />
                            </div>
                            <button
                              onClick={() => handleAddContact(opp.id)}
                              disabled={savingContact === opp.id || !contactForm[opp.id]?.canal}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
                            >
                              {savingContact === opp.id ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Tab: Actions ── */}
                      {tab === 'actions' && (
                        <div className="space-y-4">
                          {opp.status === 'mandat' && (
                            <div className="bg-green-950 border border-green-800 rounded p-3 text-center">
                              <span className="text-green-300 font-semibold">🎉 Mandat signé!</span>
                            </div>
                          )}
                          <div>
                            <div className="text-xs font-semibold text-zinc-400 mb-2">Changer le statut</div>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { status: 'contacte', label: 'Contacté', cls: 'bg-blue-900 hover:bg-blue-800 text-blue-200' },
                                { status: 'rdv', label: 'RDV fixé', cls: 'bg-purple-900 hover:bg-purple-800 text-purple-200' },
                                { status: 'mandat', label: 'Mandat signé', cls: 'bg-green-900 hover:bg-green-800 text-green-200' },
                                { status: 'perdu', label: 'Perdu', cls: 'bg-red-950 hover:bg-red-900 text-red-300' },
                              ].map(s => (
                                <button
                                  key={s.status}
                                  onClick={() => handleUpdateStatus(opp.id, s.status)}
                                  disabled={opp.status === s.status}
                                  className={`px-3 py-1.5 text-sm rounded transition-colors disabled:opacity-40 ${s.cls}`}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-zinc-400 mb-2">Notes internes</div>
                            <textarea
                              value={notes[opp.id] ?? opp.internalNotes ?? ''}
                              onChange={e => setNotes(prev => ({ ...prev, [opp.id]: e.target.value }))}
                              rows={4}
                              placeholder="Notes, observations, informations sur le vendeur..."
                              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500"
                            />
                            <button
                              onClick={() => handleSaveNotes(opp.id)}
                              disabled={savingNotes === opp.id}
                              className="mt-2 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-200 text-sm rounded transition-colors"
                            >
                              {savingNotes === opp.id ? 'Sauvegarde...' : 'Sauvegarder les notes'}
                            </button>
                          </div>
                          {opp.listingUrl && (
                            <div>
                              <a
                                href={opp.listingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-400 hover:text-blue-300 underline"
                              >
                                Voir l'annonce originale →
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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

function NoScript({ onAnalyze, analyzing }: { onAnalyze: () => void; analyzing: boolean }) {
  return (
    <div className="text-center py-6">
      <p className="text-zinc-500 text-sm mb-3">Aucun script généré. Analysez d'abord l'opportunité.</p>
      {analyzing ? (
        <p className="text-orange-400 text-xs animate-pulse">Analyse en cours...</p>
      ) : (
        <button
          onClick={onAnalyze}
          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded transition-colors"
        >
          Analyser maintenant
        </button>
      )}
    </div>
  );
}
