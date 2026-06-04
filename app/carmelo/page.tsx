'use client';

import { useState } from 'react';
import CarmeloNav from './nav';

export default function CarmeloPage() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAnalyze() {
    if (!input.trim()) return;
    setLoading(true);
    setResult('');
    setError('');

    try {
      const res = await fetch('/api/carmelo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicule: input }),
      });

      // Errors are returned as JSON; a successful analysis is streamed as text.
      const contentType = res.headers.get('Content-Type') || '';
      if (!res.ok || contentType.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Erreur serveur.');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError('Flux indisponible.');
        return;
      }

      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setResult(acc);
      }
    } catch {
      setError('Erreur réseau. Vérifiez la connexion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl space-y-6">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carmelo — GP-CARS</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Directeur des Achats · Analyste Marché
          </p>
        </div>

        <CarmeloNav active="analyser" />

        <div className="space-y-2">
          <label className="text-sm text-zinc-400">
            Décrivez le véhicule (annonce, e-mail, descriptif texte)
          </label>
          <textarea
            className="w-full h-48 bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-500"
            placeholder={`Exemple :\nKia Stonic 1.0 T-GDI 120ch DCT7, 2023, 28 000 km\nEntretien concession à jour, pneus 80 %, aucun défaut carrosserie\nGarantie constructeur restante, CT non fait\nPrix demandé : 17 500 €`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !input.trim()}
          className="px-6 py-2.5 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Analyse en cours...' : 'Analyser'}
        </button>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg p-4 text-sm space-y-2">
            <p>{error}</p>
            {error.includes('Clé API') && (
              <a href="/settings" className="underline text-red-200 block">
                → Configurer la clé API ici
              </a>
            )}
          </div>
        )}

        {result && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6">
            <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-mono leading-relaxed">
              {result}
            </pre>
          </div>
        )}

      </div>
    </div>
  );
}
