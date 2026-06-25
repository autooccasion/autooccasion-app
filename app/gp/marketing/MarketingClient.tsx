'use client';

import { useState, useCallback } from 'react';
import type { VehicleRecord } from 'app/db';
import { getPriceAction } from '@/lib/marketing/price-rules';

// ─── types ───────────────────────────────────────────────────────────────────

type PlatformKey = 'autoscout24' | '2ememain' | 'leboncoin';

const PLATFORM_LABELS: Record<PlatformKey, string> = {
  autoscout24: 'AutoScout24',
  '2ememain': '2ememain.be',
  leboncoin: 'leboncoin.fr',
};

const PLATFORM_URLS: Record<PlatformKey, string> = {
  autoscout24: 'https://www.autoscout24.be/fr/vendre',
  '2ememain': 'https://www.2ememain.be/poser-une-annonce/',
  leboncoin: 'https://www.leboncoin.fr/deposer-une-annonce',
};

const STATUS_LABELS: Record<string, string> = {
  achete: 'Acheté',
  en_stock: 'En stock',
  publie: 'Publié',
};
const STATUS_COLORS: Record<string, string> = {
  achete: 'bg-yellow-950 text-yellow-300 border-yellow-800',
  en_stock: 'bg-orange-950 text-orange-300 border-orange-800',
  publie: 'bg-purple-950 text-purple-300 border-purple-800',
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function euro(n: number | null) {
  return n == null ? '—' : `${n.toLocaleString('fr-BE')} €`;
}

function daysAgo(d: Date | string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

function PriceActionBadge({ vehicle }: { vehicle: VehicleRecord }) {
  const action = getPriceAction(vehicle);
  if (action.action === 'none') return null;
  const cfg = {
    reduce: 'bg-amber-950 border-amber-800 text-amber-300',
    alert: 'bg-orange-950 border-orange-800 text-orange-300',
    human_required: 'bg-red-950 border-red-800 text-red-300',
  }[action.action];
  const icon = { reduce: '📉', alert: '⚠️', human_required: '🚨' }[action.action];
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${cfg}`}>
      {icon} {action.action === 'reduce' ? `J+${action.daysInStock} − ${action.amount} €` : `J+${action.daysInStock}`}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors"
    >
      {copied ? '✓ Copié' : 'Copier'}
    </button>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function MarketingClient({ initialVehicles }: { initialVehicles: VehicleRecord[] }) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>(initialVehicles);
  const [generating, setGenerating] = useState<number | null>(null);
  const [genError, setGenError] = useState<Record<number, string>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [platformTab, setPlatformTab] = useState<Record<number, PlatformKey>>({});
  const [filter, setFilter] = useState<'all' | 'sans_annonce' | 'action_requise' | 'publie'>('all');
  const [publishing, setPublishing] = useState<number | null>(null);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  const handleGenerate = async (vehicleId: number) => {
    setGenerating(vehicleId);
    setGenError(e => { const n = { ...e }; delete n[vehicleId]; return n; });
    const res = await fetch('/api/agents/marketing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId }),
    });
    setGenerating(null);
    if (res.ok) {
      await reload();
      setExpandedId(vehicleId);
    } else {
      const d = await res.json().catch(() => ({}));
      setGenError(e => ({ ...e, [vehicleId]: d.error || 'Erreur lors de la génération.' }));
    }
  };

  const handlePublish = async (vehicleId: number, platforms: string[]) => {
    setPublishing(vehicleId);
    await fetch('/api/agents/vehicle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set_status',
        id: vehicleId,
        status: 'publie',
        platforms,
        publishedAt: new Date().toISOString(),
      }),
    });
    setPublishing(null);
    await reload();
  };

  const filtered = vehicles.filter(v => {
    if (filter === 'sans_annonce') return !v.listingTitle;
    if (filter === 'action_requise') return getPriceAction(v).action !== 'none';
    if (filter === 'publie') return v.status === 'publie';
    return true;
  });

  const stats = {
    total: vehicles.length,
    withListing: vehicles.filter(v => v.listingTitle).length,
    publie: vehicles.filter(v => v.status === 'publie').length,
    actionRequired: vehicles.filter(v => getPriceAction(v).action !== 'none').length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Agent Marketing VO</h2>
          <p className="text-sm text-zinc-500 mt-0.5">AutoScout24 · 2ememain.be · leboncoin.fr — annonces en 3 clics</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Véhicules', value: stats.total },
          { label: 'Annonces rédigées', value: `${stats.withListing}/${stats.total}`, color: stats.withListing === stats.total ? 'text-green-400' : 'text-amber-400' },
          { label: 'Publiés', value: stats.publie, color: 'text-purple-300' },
          { label: 'Action requise', value: stats.actionRequired, color: stats.actionRequired > 0 ? 'text-red-400' : 'text-zinc-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className={`text-2xl font-bold ${s.color || 'text-zinc-100'}`}>{s.value}</div>
            <div className="text-xs text-zinc-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-zinc-800 pb-px">
        {([
          { key: 'all',           label: `Tous (${stats.total})` },
          { key: 'sans_annonce',  label: `Sans annonce (${stats.total - stats.withListing})` },
          { key: 'action_requise',label: `Action requise (${stats.actionRequired})` },
          { key: 'publie',        label: `Publiés (${stats.publie})` },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-sm whitespace-nowrap rounded-t-md transition-colors ${filter === f.key ? 'bg-zinc-900 text-zinc-100 border-b-2 border-white -mb-px' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Vehicle list */}
      {filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
          Aucun véhicule dans cette catégorie.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(v => {
            const isExpanded = expandedId === v.id;
            const label = [v.make, v.model, v.year].filter(Boolean).join(' ') || 'Véhicule';
            const hasDraft = !!v.listingTitle;
            const isGenerating = generating === v.id;
            const platforms = v.platformDrafts as Record<string, { titre: string; description: string }> | null;
            const activePlatform: PlatformKey = platformTab[v.id] ?? 'autoscout24';
            const daysPublished = v.publishedAt ? daysAgo(v.publishedAt) : null;
            const priceAction = getPriceAction(v);

            return (
              <div key={v.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                {/* Summary row */}
                <button
                  className="w-full text-left px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-zinc-200 text-sm">{label}</span>
                      {v.km != null && <span className="text-xs text-zinc-500">{v.km.toLocaleString('fr-BE')} km</span>}
                      <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[v.status ?? 'en_stock'] || 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                        {STATUS_LABELS[v.status ?? ''] || v.status}
                      </span>
                      <PriceActionBadge vehicle={v} />
                    </div>
                    <div className="text-xs text-zinc-500 mt-1 flex flex-wrap gap-3">
                      {v.askingPrice != null && <span>Prix : {euro(v.askingPrice)}</span>}
                      {daysPublished != null && <span>Publié il y a {daysPublished} j</span>}
                      {hasDraft ? (
                        <span className="text-green-400">✓ Annonce rédigée</span>
                      ) : (
                        <span className="text-amber-400">⚠ Pas d&apos;annonce</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!hasDraft && (
                      <button
                        onClick={e => { e.stopPropagation(); handleGenerate(v.id); }}
                        disabled={isGenerating}
                        className="px-3 py-1.5 text-xs bg-blue-900 border border-blue-700 text-blue-300 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors"
                      >
                        {isGenerating ? '⏳ Génération...' : '⚡ Générer'}
                      </button>
                    )}
                    <span className="text-zinc-600 text-lg">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 p-4 space-y-4">

                    {/* Generate / Regenerate */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleGenerate(v.id)}
                        disabled={isGenerating}
                        className={`px-4 py-2 text-sm rounded-lg disabled:opacity-60 transition-colors ${hasDraft ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-blue-900 border border-blue-700 text-blue-300 hover:bg-blue-800'}`}
                      >
                        {isGenerating ? '⏳ Génération en cours...' : hasDraft ? '↺ Regénérer l\'annonce' : '⚡ Générer l\'annonce IA'}
                      </button>
                      {v.status === 'en_stock' && hasDraft && (
                        <button
                          onClick={() => handlePublish(v.id, ['autoscout24', '2ememain', 'leboncoin'])}
                          disabled={publishing === v.id}
                          className="px-4 py-2 text-sm bg-purple-900 border border-purple-700 text-purple-300 rounded-lg hover:bg-purple-800 disabled:opacity-60 transition-colors"
                        >
                          {publishing === v.id ? '...' : '✓ Marquer comme publié'}
                        </button>
                      )}
                      {genError[v.id] && <span className="text-xs text-red-400">{genError[v.id]}</span>}
                    </div>

                    {/* Price rotation alert */}
                    {priceAction.action !== 'none' && (
                      <div className={`rounded-lg p-3 text-sm ${priceAction.action === 'human_required' ? 'bg-red-950 border border-red-800 text-red-300' : priceAction.action === 'alert' ? 'bg-orange-950 border border-orange-800 text-orange-300' : 'bg-amber-950 border border-amber-800 text-amber-300'}`}>
                        <strong>{priceAction.action === 'human_required' ? '🚨 Décision urgente requise' : priceAction.action === 'alert' ? '⚠️ Alerte immobilisation' : '📉 Réduction de prix recommandée'}</strong>
                        <p className="text-xs mt-1 opacity-80">{'reason' in priceAction ? priceAction.reason : ''}</p>
                        {'amount' in priceAction && (
                          <p className="text-xs mt-0.5 font-semibold">Réduction suggérée : −{priceAction.amount.toLocaleString('fr-BE')} €</p>
                        )}
                      </div>
                    )}

                    {/* Platform tabs + content */}
                    {hasDraft && (
                      <div className="space-y-3">
                        <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto scrollbar-none">
                          {(['autoscout24', '2ememain', 'leboncoin'] as PlatformKey[]).map(pk => (
                            <button
                              key={pk}
                              onClick={() => setPlatformTab(t => ({ ...t, [v.id]: pk }))}
                              className={`px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${activePlatform === pk ? 'text-zinc-100 border-b-2 border-white -mb-px' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                              {PLATFORM_LABELS[pk]}
                            </button>
                          ))}
                          <button
                            onClick={() => setPlatformTab(t => ({ ...t, [v.id]: 'autoscout24' }))}
                            className="ml-auto text-xs text-zinc-600 hover:text-zinc-400 px-2"
                            title="Universel"
                          >
                            Universel
                          </button>
                        </div>

                        {(['autoscout24', '2ememain', 'leboncoin'] as PlatformKey[]).map(pk => {
                          if (activePlatform !== pk) return null;
                          const pd = platforms?.[pk];
                          const titre = pd?.titre || v.listingTitle || '';
                          const description = pd?.description || v.listingDescription || '';
                          return (
                            <div key={pk} className="space-y-3">
                              {/* Titre */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-zinc-500 uppercase tracking-wide">Titre ({titre.length} car.)</span>
                                  <div className="flex gap-2">
                                    <CopyButton text={titre} />
                                    <a
                                      href={PLATFORM_URLS[pk]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors"
                                    >
                                      Publier ↗
                                    </a>
                                  </div>
                                </div>
                                <div className="bg-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 font-medium">
                                  {titre}
                                </div>
                              </div>

                              {/* Description */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-zinc-500 uppercase tracking-wide">Description ({description.length} car.)</span>
                                  <CopyButton text={description} />
                                </div>
                                <pre className="bg-zinc-800 rounded-lg p-3 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                                  {description}
                                </pre>
                              </div>
                            </div>
                          );
                        })}

                        {/* Points forts + tags */}
                        {v.listingPoints && v.listingPoints.length > 0 && (
                          <div>
                            <div className="text-xs text-zinc-500 mb-1.5">Points forts</div>
                            <div className="flex flex-wrap gap-1.5">
                              {(v.listingPoints as string[]).map((p, i) => (
                                <span key={i} className="text-xs bg-green-950 border border-green-900 text-green-300 px-2 py-0.5 rounded">✓ {p}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {v.listingTags && (v.listingTags as string[]).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {(v.listingTags as string[]).map((t, i) => (
                              <span key={i} className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded">#{t}</span>
                            ))}
                          </div>
                        )}

                        {/* Copy all for platform */}
                        {(() => {
                          const pd = platforms?.[activePlatform];
                          const titre = pd?.titre || v.listingTitle || '';
                          const desc = pd?.description || v.listingDescription || '';
                          const full = `${titre}\n\n${desc}`;
                          return (
                            <div className="pt-1">
                              <CopyButton text={full} />
                              <span className="ml-2 text-xs text-zinc-600">Copier titre + description d&apos;un coup</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Vehicle details */}
                    <div className="text-xs text-zinc-600 border-t border-zinc-800 pt-3">
                      #{v.id}
                      {v.fuel && ` · ${v.fuel}`}
                      {v.gearbox && ` · ${v.gearbox}`}
                      {v.color && ` · ${v.color}`}
                      {v.power && ` · ${v.power}`}
                      {v.vin && ` · VIN : ${v.vin}`}
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
