'use client';

import { useState } from 'react';
import Link from 'next/link';
import CarmeloNav from '../nav';

type ScanEntry = {
  url: string;
  ok: boolean;
  decision?: string;
  make?: string | null;
  vehicleId?: number;
  maxBuyPrice?: number | null;
  estimatedMargin?: number | null;
  confidence?: number | null;
  error?: string;
};

type ScanResponse = {
  found: number;
  new: number;
  analyzed: number;
  results: ScanEntry[];
  message: string;
  scraperWarning?: string;
  scraperApiActive?: boolean;
  via?: string;
  error?: string;
};

function ScraperApiStatus({ result }: { result: ScanResponse | null }) {
  // After a scan, show whether ScraperAPI was active.
  if (result) {
    if (result.scraperApiActive) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-green-800 bg-green-900/20 px-3 py-2 text-xs text-green-300">
          <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
          ScraperAPI actif — rendu JavaScript + anti-bot activé
          <span className="ml-auto text-green-500">via {result.via}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 rounded-lg border border-yellow-800 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-300">
        <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
        ScraperAPI non configuré — fetch direct (AutoScout24 peut bloquer)
        <a
          href="https://www.scraperapi.com"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto underline hover:text-yellow-200"
        >
          Activer →
        </a>
      </div>
    );
  }
  // Before first scan, show setup hint.
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-500">
      Pour un scraping fiable, ajoutez{' '}
      <code className="text-zinc-300">SCRAPERAPI_KEY</code> dans vos variables Vercel.{' '}
      <a
        href="https://www.scraperapi.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-zinc-400 underline hover:text-zinc-300"
      >
        Créer un compte gratuit →
      </a>
    </div>
  );
}

const DECISION_STYLE: Record<string, string> = {
  OR:     'bg-yellow-500/20 text-yellow-300 border border-yellow-600',
  VERT:   'bg-green-500/20 text-green-300 border border-green-700',
  ORANGE: 'bg-orange-500/20 text-orange-300 border border-orange-700',
  ROUGE:  'bg-red-500/20 text-red-400 border border-red-700',
  INCONNU:'bg-zinc-700/40 text-zinc-400 border border-zinc-600',
};

function DecisionBadge({ decision }: { decision?: string }) {
  const d = decision ?? 'INCONNU';
  const label = d === 'OR' ? '🥇 OR' : d === 'VERT' ? '🟢 VERT' : d === 'ORANGE' ? '🟠 ORANGE' : d === 'ROUGE' ? '🔴 ROUGE' : d;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DECISION_STYLE[d] ?? DECISION_STYLE['INCONNU']}`}>
      {label}
    </span>
  );
}

export default function ScannerPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [error, setError] = useState('');

  async function handleScan() {
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const res = await fetch('/api/scanner/run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur serveur.');
      } else {
        setResult(data as ScanResponse);
      }
    } catch {
      setError('Erreur réseau. Vérifiez la connexion.');
    } finally {
      setLoading(false);
    }
  }

  const goodOnes = result?.results.filter(
    (r) => r.ok && (r.decision === 'OR' || r.decision === 'VERT' || r.decision === 'ORANGE'),
  ) ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <CarmeloNav active="scanner" />

        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Scanner AutoScout24</h1>
          <p className="text-sm text-zinc-400">
            Parcourt AutoScout24.be avec les critères GP-CARS (2021+, ≤ 80 000 km, 12–20 k€, boîte auto)
            et soumet les nouvelles annonces à Carmelo automatiquement.
          </p>
        </div>

        {/* Criteria summary */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300 space-y-1">
          <p className="font-medium text-zinc-200 mb-2">Critères de recherche actifs</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-400">
            <span>Marques</span><span className="text-zinc-200">Kia · Hyundai · Toyota · VW · Audi · BMW · Mercedes</span>
            <span>Année</span><span className="text-zinc-200">2021 et plus récent</span>
            <span>Kilométrage</span><span className="text-zinc-200">≤ 80 000 km</span>
            <span>Prix</span><span className="text-zinc-200">12 000 – 20 000 €</span>
            <span>Boîte</span><span className="text-zinc-200">Automatique</span>
            <span>Marché</span><span className="text-zinc-200">Belgique</span>
          </div>
        </div>

        {/* ScraperAPI status */}
        <ScraperApiStatus result={result} />

        {/* Action */}
        <button
          onClick={handleScan}
          disabled={loading}
          className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Scan en cours… (30–60 s)
            </span>
          ) : (
            'Lancer le scan'
          )}
        </button>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Annonces trouvées', value: result.found },
                { label: 'Nouvelles', value: result.new },
                { label: 'Analysées', value: result.analyzed },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-center">
                  <div className="text-2xl font-bold text-zinc-100">{value}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {result.scraperWarning && (
              <div className="rounded-lg border border-yellow-800 bg-yellow-900/20 p-3 text-xs text-yellow-300">
                ⚠️ {result.scraperWarning}
              </div>
            )}

            <p className="text-sm text-zinc-300">{result.message}</p>

            {/* Opportunities (OR / VERT / ORANGE) */}
            {goodOnes.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-zinc-200">
                  Opportunités identifiées ({goodOnes.length})
                </h2>
                {goodOnes.map((r) => (
                  <div
                    key={r.url}
                    className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-200">
                        {r.make ?? 'Véhicule inconnu'}
                      </span>
                      <DecisionBadge decision={r.decision} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs text-zinc-400">
                      <div>
                        <div className="text-zinc-500">Prix max</div>
                        <div className="text-zinc-200 font-medium">
                          {r.maxBuyPrice != null ? `${r.maxBuyPrice.toLocaleString('fr-BE')} €` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Marge estimée</div>
                        <div className="text-zinc-200 font-medium">
                          {r.estimatedMargin != null ? `${r.estimatedMargin.toLocaleString('fr-BE')} €` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Confiance</div>
                        <div className="text-zinc-200 font-medium">
                          {r.confidence != null ? `${r.confidence} %` : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      {r.vehicleId && (
                        <Link
                          href={`/gp/vehicle/${r.vehicleId}`}
                          className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                        >
                          Voir l'analyse complète →
                        </Link>
                      )}
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-400 hover:text-zinc-300 underline"
                      >
                        Annonce AutoScout24 ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* All results table */}
            {result.results.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-zinc-400">Toutes les analyses</h2>
                <div className="rounded-lg border border-zinc-800 divide-y divide-zinc-800">
                  {result.results.map((r) => (
                    <div key={r.url} className="flex items-center gap-3 px-4 py-2 text-sm">
                      {r.ok ? (
                        <>
                          <DecisionBadge decision={r.decision} />
                          <span className="flex-1 text-zinc-300 truncate">
                            {r.make ?? 'Inconnu'}
                          </span>
                          {r.vehicleId && (
                            <Link
                              href={`/gp/vehicle/${r.vehicleId}`}
                              className="text-xs text-indigo-400 hover:text-indigo-300"
                            >
                              Détails →
                            </Link>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-red-400 font-medium">ÉCHEC</span>
                          <span className="flex-1 text-zinc-500 text-xs truncate">{r.error}</span>
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-zinc-500 hover:text-zinc-400"
                          >
                            ↗
                          </a>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <Link href="/gp/stock" className="text-sm text-indigo-400 hover:text-indigo-300">
                ← Voir le stock complet
              </Link>
            </div>
          </div>
        )}

        {/* No results yet */}
        {!loading && !result && !error && (
          <p className="text-sm text-zinc-500 text-center py-8">
            Cliquez sur &ldquo;Lancer le scan&rdquo; pour que Carmelo recherche automatiquement
            les meilleures opportunités sur AutoScout24.
          </p>
        )}
      </div>
    </div>
  );
}
