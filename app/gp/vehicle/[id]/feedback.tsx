'use client';

import { useState } from 'react';

type Props = {
  vehicleId: number;
  current: 'correct' | 'incorrect' | null | undefined;
};

export default function FeedbackPanel({ vehicleId, current }: Props) {
  const [state, setState] = useState<'correct' | 'incorrect' | null>(current ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(feedback: 'correct' | 'incorrect') {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/agents/vehicle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_feedback', id: vehicleId, feedback }),
      });
      if (res.ok) {
        setState(feedback);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-500">Cette analyse était-elle correcte ?</span>
      <button
        disabled={saving}
        onClick={() => submit('correct')}
        className={`px-3 py-1 text-xs rounded-lg border transition-colors disabled:opacity-40 ${
          state === 'correct'
            ? 'bg-green-900 border-green-700 text-green-300'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-green-700 hover:text-green-400'
        }`}
      >
        👍 Oui
      </button>
      <button
        disabled={saving}
        onClick={() => submit('incorrect')}
        className={`px-3 py-1 text-xs rounded-lg border transition-colors disabled:opacity-40 ${
          state === 'incorrect'
            ? 'bg-red-900 border-red-700 text-red-300'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-red-700 hover:text-red-400'
        }`}
      >
        👎 Non
      </button>
      {saved && <span className="text-xs text-zinc-400">Enregistré — Carmelo apprendra de ce retour.</span>}
    </div>
  );
}
