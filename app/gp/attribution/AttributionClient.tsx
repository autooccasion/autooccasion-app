'use client';

import { useState, useCallback, useEffect } from 'react';

// Types
interface GaeOpportunite {
  id: number;
  gaeId: string;
  type: string;
  agentSource: string;
  status: string;
  title?: string | null;
  attributionConfidence?: number | null;
  estimatedValue?: number | null;
  realValue?: number | null;
  marginEstimated?: number | null;
  marginReal?: number | null;
  commissionEstimated?: number | null;
  commissionReal?: number | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: number | null;
  isDuplicate?: boolean | null;
  circumventionFlags?: string[] | null;
  billed?: boolean | null;
  billAmount?: number | null;
  detectedAt?: string | null;
  transformedAt?: string | null;
}

interface Stats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byAgent: Record<string, number>;
  transformedCount: number;
  transformationRate: number;
  commissionEstimee: number;
  commissionRealisee: number;
  circumventionCount: number;
  duplicateCount: number;
  highConfidenceCount: number;
}

interface AgentReport {
  agent: string;
  total: number;
  transformed: number;
  rate: number;
  commissionEstimee: number;
  commissionRealisee: number;
  avgConfidence: number;
}

// Status styling
const STATUS_STYLES: Record<string, string> = {
  detectee:    'bg-zinc-800 text-zinc-300',
  contactee:   'bg-blue-950 text-blue-300',
  qualifiee:   'bg-indigo-950 text-indigo-300',
  rdv:         'bg-purple-950 text-purple-300',
  negociation: 'bg-orange-950 text-orange-300',
  transformee: 'bg-green-950 text-green-300',
  perdue:      'bg-red-950 text-red-400',
  annulee:     'bg-zinc-900 text-zinc-600',
};

const TYPE_LABELS: Record<string, string> = {
  achat:       'Achat',
  mandat:      'Mandat',
  vente:       'Vente',
  garantie:    'Garantie',
  atelier:     'Atelier',
  lead:        'Lead',
  marketing:   'Marketing',
  financement: 'Financement',
};

const AGENT_LABELS: Record<string, string> = {
  carmelo:   'Carmelo',
  mandats:   'Mandats VO',
  madore:    'MADORE',
  garantie:  'Garantie',
  atelier:   'Atelier',
  marketing: 'Marketing',
  manuel:    'Manuel',
};

function ConfidenceBadge({ score }: { score: number | null | undefined }) {
  const v = score ?? 0;
  const color = v === 100 ? 'text-green-400' : v >= 75 ? 'text-blue-400' : v >= 50 ? 'text-yellow-400' : v >= 25 ? 'text-orange-400' : 'text-red-400';
  return <span className={`text-xs font-bold ${color}`}>{v}%</span>;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[status] ?? STATUS_STYLES.detectee}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function AttributionClient() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [report, setReport] = useState<AgentReport[]>([]);
  const [opps, setOpps]     = useState<GaeOpportunite[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded]   = useState(false);
  const [filterType, setFilterType]     = useState<string>('tous');
  const [filterStatus, setFilterStatus] = useState<string>('tous');
  const [filterAgent, setFilterAgent]   = useState<string>('tous');
  const [activeView, setActiveView]     = useState<'dashboard' | 'opportunities' | 'report' | 'billing'>('dashboard');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, reportRes, oppsRes] = await Promise.all([
        fetch('/api/gae/stats'),
        fetch('/api/gae/report'),
        fetch('/api/gae/opportunites'),
      ]);
      if (statsRes.ok)  { const d = await statsRes.json();  setStats(d.stats ?? null); }
      if (reportRes.ok) { const d = await reportRes.json(); setReport(d.report ?? []); }
      if (oppsRes.ok)   { const d = await oppsRes.json();   setOpps(d.opportunites ?? []); }
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredOpps = opps.filter(o => {
    if (filterType !== 'tous'   && o.type        !== filterType)   return false;
    if (filterStatus !== 'tous' && o.status      !== filterStatus) return false;
    if (filterAgent !== 'tous'  && o.agentSource !== filterAgent)  return false;
    return true;
  });

  const circumventionOpps = opps.filter(o => Array.isArray(o.circumventionFlags) && o.circumventionFlags.length > 0);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attribution Engine</h1>
          <p className="text-sm text-zinc-400 mt-1">Traçabilité et ROI par agent IA — Lead Certifié</p>
        </div>
        <button onClick={load} className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg">
          {loading ? 'Chargement…' : '↻ Rafraîchir'}
        </button>
      </div>

      {/* KPI Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-center">
            <p className="text-xs text-zinc-500">Total</p>
            <p className="text-2xl font-bold text-zinc-200">{stats.total}</p>
          </div>
          <div className="bg-green-950 border border-green-800 rounded-lg p-3 text-center">
            <p className="text-xs text-green-500">Transformées</p>
            <p className="text-2xl font-bold text-green-300">{stats.transformedCount}</p>
          </div>
          <div className="bg-blue-950 border border-blue-800 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-500">Taux conv.</p>
            <p className="text-2xl font-bold text-blue-300">{stats.transformationRate}%</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-center">
            <p className="text-xs text-zinc-500">Comm. estimée</p>
            <p className="text-lg font-bold text-green-400">{(stats.commissionEstimee / 1000).toFixed(1)}k€</p>
          </div>
          {stats.circumventionCount > 0 && (
            <div className="bg-red-950 border border-red-800 rounded-lg p-3 text-center">
              <p className="text-xs text-red-400">Contournements</p>
              <p className="text-2xl font-bold text-red-300">{stats.circumventionCount}</p>
            </div>
          )}
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-center">
            <p className="text-xs text-zinc-500">Conf. ≥75%</p>
            <p className="text-2xl font-bold text-zinc-200">{stats.highConfidenceCount}</p>
          </div>
        </div>
      )}

      {/* View tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {(['dashboard', 'opportunities', 'report', 'billing'] as const).map(v => (
          <button key={v} onClick={() => setActiveView(v)}
            className={`text-xs px-3 py-1.5 rounded-lg shrink-0 transition-colors ${activeView === v ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800'}`}>
            {v === 'dashboard' ? 'Dashboard' : v === 'opportunities' ? 'Opportunités' : v === 'report' ? 'Rapport agents' : 'Facturation'}
          </button>
        ))}
      </div>

      {/* DASHBOARD VIEW */}
      {activeView === 'dashboard' && stats && (
        <div className="space-y-6">
          {/* Funnel */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4">Entonnoir Global</h2>
            <div className="flex gap-2 items-end flex-wrap">
              {['detectee', 'contactee', 'qualifiee', 'rdv', 'negociation', 'transformee'].map(s => {
                const count = stats.byStatus[s] ?? 0;
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={s} className="flex-1 min-w-[60px] text-center space-y-1">
                    <div className="mx-auto bg-zinc-700 rounded" style={{ height: `${Math.max(8, pct * 2)}px`, minHeight: '8px' }} />
                    <p className="text-xs text-zinc-400">{s.charAt(0).toUpperCase() + s.slice(1)}</p>
                    <p className="text-sm font-bold text-zinc-200">{count}</p>
                    <p className="text-xs text-zinc-600">{pct}%</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By agent */}
          {Object.keys(stats.byAgent).length > 0 && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">Opportunités par agent</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(stats.byAgent).map(([agent, count]) => (
                  <div key={agent} className="bg-zinc-800 rounded p-3">
                    <p className="text-xs text-zinc-400">{AGENT_LABELS[agent] ?? agent}</p>
                    <p className="text-xl font-bold text-zinc-200">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Circumvention alerts */}
          {circumventionOpps.length > 0 && (
            <div className="bg-red-950 border border-red-800 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-red-300 mb-3">Alertes contournement ({circumventionOpps.length})</h2>
              <div className="space-y-2">
                {circumventionOpps.map(o => (
                  <div key={o.id} className="bg-red-900/30 rounded p-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-red-200">{o.gaeId}</span>
                    <span className="text-xs text-red-300">{[o.vehicleMake, o.vehicleModel, o.vehicleYear].filter(Boolean).join(' ') || o.title || '—'}</span>
                    <div className="flex gap-1 flex-wrap">
                      {(o.circumventionFlags ?? []).map((f, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 bg-red-800 text-red-200 rounded">{f}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loaded && <div className="text-center py-8 text-zinc-500 text-sm">Chargement…</div>}
          {loaded && stats.total === 0 && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-8 text-center">
              <p className="text-zinc-400 text-sm">Aucune opportunité trackée pour l&apos;instant.</p>
              <p className="text-zinc-600 text-xs mt-1">Les opportunités générées par les agents IA apparaîtront ici automatiquement.</p>
            </div>
          )}
        </div>
      )}

      {/* OPPORTUNITIES VIEW */}
      {activeView === 'opportunities' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200">
              <option value="tous">Tous types</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200">
              <option value="tous">Tous statuts</option>
              {['detectee', 'contactee', 'qualifiee', 'rdv', 'negociation', 'transformee', 'perdue', 'annulee'].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)}
              className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200">
              <option value="tous">Tous agents</option>
              {Object.entries(AGENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <p className="text-xs text-zinc-500 self-center">{filteredOpps.length} opportunités</p>
          </div>

          {!loaded && <div className="text-center py-8 text-zinc-500 text-sm">Chargement…</div>}
          {loaded && filteredOpps.length === 0 && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-8 text-center">
              <p className="text-zinc-400 text-sm">Aucune opportunité trouvée.</p>
              <p className="text-zinc-600 text-xs mt-1">Les opportunités générées par les agents IA apparaissent ici.</p>
            </div>
          )}

          <div className="space-y-2">
            {filteredOpps.map(o => (
              <div key={o.id} className={`bg-zinc-900 border rounded-lg p-3 flex items-center gap-3 flex-wrap ${o.isDuplicate ? 'border-yellow-800 opacity-70' : 'border-zinc-700'}`}>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-zinc-400">{o.gaeId}</span>
                    <StatusBadge status={o.status} />
                    <span className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                      {AGENT_LABELS[o.agentSource] ?? o.agentSource}
                    </span>
                    {o.isDuplicate && <span className="text-xs px-1.5 py-0.5 bg-yellow-950 text-yellow-400 border border-yellow-800 rounded">Doublon</span>}
                  </div>
                  <p className="text-sm text-zinc-200 truncate">
                    {[o.vehicleMake, o.vehicleModel, o.vehicleYear].filter(Boolean).join(' ') || o.title || TYPE_LABELS[o.type] || o.type}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <ConfidenceBadge score={o.attributionConfidence} />
                  {o.commissionEstimated && (
                    <p className="text-xs font-semibold text-green-400">{o.commissionEstimated.toLocaleString('fr-BE')} €</p>
                  )}
                  <p className="text-xs text-zinc-600">
                    {o.detectedAt ? new Date(o.detectedAt).toLocaleDateString('fr-BE') : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REPORT VIEW */}
      {activeView === 'report' && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300">Performance par agent</h2>
          {report.length === 0 && loaded && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 text-center">
              <p className="text-zinc-400 text-sm">Aucune donnée de performance disponible.</p>
            </div>
          )}
          <div className="space-y-3">
            {report.map(r => (
              <div key={r.agent} className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">{AGENT_LABELS[r.agent] ?? r.agent}</p>
                    <p className="text-xs text-zinc-500">{r.total} opportunités · {r.transformed} transformées</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-400">{r.commissionEstimee.toLocaleString('fr-BE')} €</p>
                    <p className="text-xs text-zinc-500">estimés</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-zinc-500">Taux conv.</p>
                    <p className="text-base font-bold text-zinc-200">{r.rate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Confiance moy.</p>
                    <ConfidenceBadge score={r.avgConfidence} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Réalisé</p>
                    <p className="text-base font-bold text-zinc-400">{r.commissionRealisee.toLocaleString('fr-BE')} €</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3">
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${r.rate}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BILLING VIEW */}
      {activeView === 'billing' && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-300">Barème de facturation</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Agent</th>
                  <th className="text-right py-2">Tarif succès</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {[
                  { type: 'achat',       agent: 'Carmelo',     rate: 100 },
                  { type: 'mandat',      agent: 'Mandats VO',  rate: 50  },
                  { type: 'vente',       agent: 'Marketing',   rate: 50  },
                  { type: 'garantie',    agent: 'Garantie',    rate: 30  },
                  { type: 'atelier',     agent: 'Atelier',     rate: 20  },
                  { type: 'lead',        agent: 'MADORE',      rate: 10  },
                  { type: 'financement', agent: 'Financement', rate: 75  },
                ].map(row => (
                  <tr key={row.type} className="border-b border-zinc-800/50">
                    <td className="py-2">{TYPE_LABELS[row.type]}</td>
                    <td className="py-2 text-zinc-400">{row.agent}</td>
                    <td className="py-2 text-right font-semibold text-green-400">{row.rate} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-zinc-600">Facturation à la transformation — aucun frais si l&apos;opportunité échoue.</p>
          </div>

          {/* Non-billed transformed */}
          {(() => {
            const toBill = opps.filter(o => o.status === 'transformee' && !o.billed);
            const totalToBill = toBill.reduce((s, o) => s + (o.commissionEstimated ?? 0), 0);
            return toBill.length > 0 ? (
              <div className="bg-green-950 border border-green-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-green-300">À facturer ({toBill.length} opportunités)</h2>
                  <p className="text-lg font-bold text-green-300">{totalToBill.toLocaleString('fr-BE')} €</p>
                </div>
                <div className="space-y-2">
                  {toBill.map(o => (
                    <div key={o.id} className="flex items-center justify-between text-xs bg-green-900/30 rounded p-2">
                      <span className="font-mono text-green-200">{o.gaeId}</span>
                      <span className="text-green-300">{[o.vehicleMake, o.vehicleModel].filter(Boolean).join(' ') || o.title || '—'}</span>
                      <span className="font-bold text-green-300">{(o.commissionEstimated ?? 0).toLocaleString('fr-BE')} €</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}
