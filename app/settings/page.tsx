'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => setConfigured(d.configured));
  }, []);

  async function handleSave() {
    if (!apiKey.trim()) return;
    setSaving(true);
    setMessage('');
    setError('');

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || 'Erreur.');
    } else {
      setConfigured(true);
      setApiKey('');
      setMessage('Clé enregistrée. Carmelo est prêt.');
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-lg space-y-8">

        <div>
          <h1 className="text-2xl font-bold">Paramètres GP-CARS</h1>
          <p className="text-zinc-400 text-sm mt-1">Configuration de Carmelo</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Clé API Anthropic</h2>
            {configured === true && (
              <span className="text-green-400 text-sm">✓ Configurée</span>
            )}
            {configured === false && (
              <span className="text-red-400 text-sm">✗ Manquante</span>
            )}
          </div>

          <p className="text-zinc-400 text-sm">
            Carmelo utilise l'intelligence artificielle d'Anthropic pour analyser
            les véhicules. Entrez votre clé ci-dessous.
          </p>

          <div className="space-y-1">
            <p className="text-xs text-zinc-500">
              Où trouver la clé :{' '}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-300 underline"
              >
                console.anthropic.com/settings/keys
              </a>
            </p>
          </div>

          <input
            type="password"
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />

          <button
            onClick={handleSave}
            disabled={saving || !apiKey.trim()}
            className="w-full py-2.5 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Enregistrement...' : configured ? 'Mettre à jour la clé' : 'Enregistrer la clé'}
          </button>

          {message && (
            <p className="text-green-400 text-sm">{message}</p>
          )}
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
        </div>

        <a
          href="/carmelo"
          className="block text-center text-zinc-400 underline text-sm hover:text-zinc-200"
        >
          ← Retour à Carmelo
        </a>

      </div>
    </div>
  );
}
