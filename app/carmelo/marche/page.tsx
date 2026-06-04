'use client';

import { useState } from 'react';
import CarmeloNav from '../nav';

type Opportunity = {
  stats: { sample: number; median: number; p25: number; p75: number; min: number; max: number };
  targetSell: number;
  tier: string;
  marginTarget: number;
  costs: number;
  cushion: number;
  maxBuy: number;
  askingPrice: number;
  marginAtAsk: number;
  zone: 'vert' | 'orange' | 'rouge';
  isGoodDeal: boolean;
  exceedsCeiling: boolean;
};

const ZONE_STYLE: Record<string, string> = {
  vert: 'bg-green-950 text-green-300 border-green-800',
  orange: 'bg-orange-950 text-orange-300 border-orange-800',
  rouge: 'bg-red-950 text-red-300 border-red-800',
};

function euro(n: number): string {
  return `${n.toLocaleString('fr-BE')} €`;
}

export default function MarchePage() {
  const [vehicule, setVehicule] = useState('');
  const [asking, setAsking] = useState('');
  const [comps, setComps] = useState('');
  const [result, setResult] = useState<Opportunity | null>(null);
  const [labels, setLabels] = useState<{ asking: string; target: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState('');
  const [drafting, setDrafting] = useState(false);

  function parseComparables(text: string): number[] {
    return text
      .split(/[\n,;]+/)
      .map((s) => Number(s.replace(/[^\d]/g, '')))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  async function handleStudy() {
    const askingPrice = Number(asking.replace(/[^\d]/g, ''));
    const comparables = parseComparables(comps);
    if (!askingPrice || comparables.length < 3) {
      setError('Indiquez le prix demandé et au moins 3 prix comparables.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setMessage('');

    try {
      const res = await fetch('/api/carmelo/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ askingPrice, comparables }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur serveur.');
      } else {
        setResult(data.opportunity);
        setLabels(data.labels);
      }
    } catch {
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDraft() {
    if (!result) return;
    setDrafting(true);
    setMessage('');
    try {
      const res = await fetch('/api/carmelo/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicule: vehicule || 'Véhicule analysé',
          askingPrice: result.askingPrice,
          targetPrice: result.maxBuy,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Échec de la rédaction.');
      else setMessage(data.message);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl space-y-6">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carmelo — GP-CARS</h1>
          <p className="text-zinc-400 text-sm mt-1">Étude de marché &amp; positionnement prix</p>
        </div>

        <CarmeloNav active="marche" />

        <p className="text-xs text-zinc-500 leading-relaxed">
          Collez les prix comparables observés sur le marché (AutoScout24, Gocar…) pour un
          véhicule équivalent. Carmelo calcule la valeur de marché, positionne le prix comme
          les plateformes (« bonne affaire »…), et déduit le prix d&apos;achat maximum qui nous
          garde dans la bonne offre <strong>tout en préservant la marge</strong>.
        </p>

        <div className="space-y-3">
          <input
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            placeholder="Véhicule (ex : Kia Stonic 1.0 T-GDI 2023, 28 000 km)"
            value={vehicule}
            onChange={(e) => setVehicule(e.target.value)}
          />
          <input
            inputMode="numeric"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            placeholder="Prix demandé par le vendeur (€)"
            value={asking}
            onChange={(e) => setAsking(e.target.value)}
          />
          <textarea
            className="w-full h-32 bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-500"
            placeholder={'Prix comparables, un par ligne :\n17900\n18200\n18500\n19000'}
            value={comps}
            onChange={(e) => setComps(e.target.value)}
          />
        </div>

        <button
          onClick={handleStudy}
          disabled={loading}
          className="px-6 py-2.5 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 disabled:opacity-40 transition-colors"
        >
          {loading ? 'Calcul...' : 'Étudier le marché'}
        </button>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className={`rounded-lg border p-4 ${ZONE_STYLE[result.zone]}`}>
              <p className="text-sm font-semibold">
                {result.isGoodDeal ? '✅ Bonne affaire' : '⛔ À ne pas surenchérir'} · zone {result.zone}
              </p>
              {result.exceedsCeiling && (
                <p className="text-xs mt-1">Prix demandé au-dessus du plafond d&apos;achat GP-CARS.</p>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <Stat label="Valeur marché (médiane)" value={euro(result.stats.median)} />
              <Stat label="Fourchette" value={`${euro(result.stats.min)} – ${euro(result.stats.max)}`} />
              <Stat label="Comparables" value={`${result.stats.sample}`} />
              <Stat label="Positionnement demandé" value={labels?.asking || '—'} />
              <Stat label="Notre prix de revente cible" value={euro(result.targetSell)} />
              <Stat label="Positionnement revente" value={labels?.target || '—'} />
              <Stat label="Marge cible" value={euro(result.marginTarget)} />
              <Stat label="Frais (estim. screening)" value={euro(result.costs)} />
              <Stat label="Coussin négociation" value={euro(result.cushion)} />
              <Stat label="PRIX D'ACHAT MAX" value={euro(result.maxBuy)} highlight />
              <Stat label="Marge au prix demandé" value={euro(result.marginAtAsk)} />
            </div>

            {result.isGoodDeal && (
              <div className="space-y-3">
                <button
                  onClick={handleDraft}
                  disabled={drafting}
                  className="px-5 py-2.5 bg-zinc-100 text-black text-sm font-semibold rounded-lg hover:bg-white disabled:opacity-40 transition-colors"
                >
                  {drafting ? 'Rédaction...' : '✍️ Rédiger un message de prise de contact'}
                </button>
                <p className="text-xs text-zinc-500">
                  À relire et envoyer toi-même — Carmelo ne contacte jamais le vendeur seul.
                </p>
              </div>
            )}

            {message && (
              <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 space-y-2">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Message proposé (à valider)
                </p>
                <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">
                  {message}
                </pre>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-zinc-500 text-xs">{label}</p>
      <p className={highlight ? 'text-white font-bold' : 'text-zinc-200'}>{value}</p>
    </div>
  );
}
