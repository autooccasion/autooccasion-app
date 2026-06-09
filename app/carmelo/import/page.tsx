'use client';

import { useRef, useState } from 'react';
import CarmeloNav from '../nav';

const TEMPLATE_HEADERS = [
  'marque', 'modele', 'annee', 'km', 'carburant', 'boite', 'couleur',
  'prix_demande', 'prix_achat_reel', 'prix_vente_reel', 'jours_en_stock',
  'date_achat', 'date_vente', 'statut', 'url_annonce',
];

const TEMPLATE_EXAMPLE = [
  'Volkswagen', 'Golf', '2022', '35000', 'essence', 'automatique', 'noir',
  '18500', '16200', '19500', '42', '15/03/2025', '26/04/2025', 'vendu', '',
];

function downloadTemplate() {
  const rows = [TEMPLATE_HEADERS.join(','), TEMPLATE_EXAMPLE.join(',')];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modele_import_gpcars.csv';
  a.click();
  URL.revokeObjectURL(url);
}

type ImportResult = {
  imported: number;
  total: number;
  errors: { row: number; error: string }[];
};

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState('');

  function handleFile(f: File | null) {
    setFile(f);
    setResult(null);
    setErr('');
    if (!f) { setPreview(null); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? '';
      const lines = text
        .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        .split('\n')
        .filter((l) => l.trim());
      const sep = lines[0]?.includes(';') ? ';' : ',';
      const rows = lines.slice(0, 6).map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, '').trim()));
      setPreview(rows);
    };
    reader.readAsText(f);
  }

  async function runImport() {
    if (!file) return;
    setLoading(true);
    setErr('');
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/import', { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok || data.imported != null) {
        setResult(data);
      } else {
        setErr(data.error || 'Erreur lors de l\'import.');
      }
    } catch {
      setErr('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-4xl space-y-6">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import CSV</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Importez l&apos;historique GP-CARS pour enrichir la mémoire de Carmelo.
          </p>
        </div>

        <CarmeloNav active="import" />

        {/* Template */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Modèle CSV</h2>
          <p className="text-sm text-zinc-400">
            Téléchargez le modèle, remplissez-le et importez-le ci-dessous.
            Les colonnes obligatoires sont <span className="text-zinc-200 font-mono text-xs">marque</span> et <span className="text-zinc-200 font-mono text-xs">statut</span>.
          </p>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  {TEMPLATE_HEADERS.map((h) => (
                    <th key={h} className="px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {TEMPLATE_EXAMPLE.map((v, i) => (
                    <td key={i} className="px-2 py-1 border border-zinc-800 text-zinc-400 whitespace-nowrap">
                      {v || <span className="text-zinc-700">(vide)</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="text-xs text-zinc-500 space-y-0.5">
            <p><span className="text-zinc-300">statut</span> acceptés : prospect, analyse, achete, en_stock, publie, vendu, refuse</p>
            <p><span className="text-zinc-300">carburant</span> : essence, diesel, hybride, électrique</p>
            <p><span className="text-zinc-300">boite</span> : automatique, manuelle</p>
            <p><span className="text-zinc-300">dates</span> : JJ/MM/AAAA ou AAAA-MM-JJ</p>
          </div>
          <button
            onClick={downloadTemplate}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold rounded-lg transition-colors"
          >
            ↓ Télécharger le modèle
          </button>
        </div>

        {/* Upload */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Importer un fichier</h2>

          <div
            className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center cursor-pointer hover:border-zinc-500 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <p className="text-sm text-zinc-200">{file.name} <span className="text-zinc-500 text-xs">({Math.round(file.size / 1024)} Ko)</span></p>
            ) : (
              <p className="text-sm text-zinc-500">Glissez un fichier CSV ici ou cliquez pour sélectionner</p>
            )}
          </div>

          {/* Preview */}
          {preview && preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">Aperçu (5 premières lignes) :</p>
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse w-full">
                  <thead>
                    <tr>
                      {(preview[0] ?? []).map((h, i) => (
                        <th key={i} className="px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono whitespace-nowrap text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(1).map((row, ri) => (
                      <tr key={ri}>
                        {row.map((v, ci) => (
                          <td key={ci} className="px-2 py-1 border border-zinc-800 text-zinc-400 whitespace-nowrap max-w-[160px] truncate">
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {err && <p className="text-sm text-red-400">{err}</p>}

          <button
            disabled={!file || loading}
            onClick={runImport}
            className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-zinc-200 transition-colors"
          >
            {loading ? 'Importation…' : 'Lancer l\'import'}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Résultat</h2>

            <div className="flex gap-6">
              <Stat label="Total lignes" value={String(result.total)} />
              <Stat label="Importés" value={String(result.imported)} color="text-green-400" />
              <Stat label="Erreurs" value={String(result.errors.length)} color={result.errors.length > 0 ? 'text-red-400' : 'text-zinc-400'} />
            </div>

            {result.imported > 0 && (
              <p className="text-sm text-green-400">
                ✓ {result.imported} véhicule{result.imported > 1 ? 's' : ''} importé{result.imported > 1 ? 's' : ''}. Carmelo utilisera ces données dans ses prochaines analyses.
              </p>
            )}

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-400">Lignes ignorées :</p>
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-xs text-red-400 font-mono">{e.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color = 'text-zinc-100' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
