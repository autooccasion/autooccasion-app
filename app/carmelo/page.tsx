'use client';

import { useState } from 'react';
import { analyzeVehicle, VehicleData, CarmeloResult } from '@/lib/carmelo/analyzer';

const VERDICT_STYLE = {
  VERT:   { bg: 'bg-green-950',  border: 'border-green-700',  text: 'text-green-300',  label: '🟢 VERT — ACHETER' },
  ORANGE: { bg: 'bg-yellow-950', border: 'border-yellow-700', text: 'text-yellow-300', label: '🟠 ORANGE — NÉGOCIER' },
  ROUGE:  { bg: 'bg-red-950',    border: 'border-red-700',    text: 'text-red-300',    label: '🔴 ROUGE — REFUSER' },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-zinc-400 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500"
    />
  );
}

function Select({ ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
    />
  );
}

function Check({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded accent-white"
      />
      {label}
    </label>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 border-b border-zinc-800 ${highlight ? 'font-bold text-white' : 'text-zinc-300'}`}>
      <span className="text-zinc-400 text-sm">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function euro(n: number) { return n.toLocaleString('fr', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }); }

export default function CarmeloPage() {
  const [data, setData] = useState<VehicleData>({
    marque: '', modele: '', annee: 2023, kilometrage: 40000,
    motorisation: '', boite: 'automatique', couleur: 'gris',
    prixDemande: 0, prixMarcheEstime: 0,
    entretienRecent: true, pneusOk: true, freinsOk: true,
    carrosseriePropre: true, garantieConstructeur: false,
    ctValide: false, distanceKm: 50, devisCarrosserie: 0,
  });

  const [result, setResult] = useState<CarmeloResult | null>(null);

  function set<K extends keyof VehicleData>(key: K, value: VehicleData[K]) {
    setData(prev => ({ ...prev, [key]: value }));
    setResult(null);
  }

  function handleAnalyze() {
    setResult(analyzeVehicle(data));
  }

  const v = result ? VERDICT_STYLE[result.decision] : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carmelo — GP-CARS</h1>
          <p className="text-zinc-400 text-sm mt-1">Directeur des Achats · Analyse de véhicule</p>
        </div>

        {/* Form */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-6">

          <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">Identité du véhicule</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Marque">
              <Input placeholder="Kia, BMW…" value={data.marque} onChange={e => set('marque', e.target.value)} />
            </Field>
            <Field label="Modèle">
              <Input placeholder="Stonic, Série 3…" value={data.modele} onChange={e => set('modele', e.target.value)} />
            </Field>
            <Field label="Année">
              <Input type="number" min={2019} max={2026} value={data.annee} onChange={e => set('annee', parseInt(e.target.value) || 2023)} />
            </Field>
            <Field label="Kilométrage">
              <Input type="number" min={0} max={300000} value={data.kilometrage} onChange={e => set('kilometrage', parseInt(e.target.value) || 0)} />
            </Field>
            <Field label="Motorisation">
              <Input placeholder="1.0 T-GDI 120ch, 2.0 TDI…" value={data.motorisation} onChange={e => set('motorisation', e.target.value)} />
            </Field>
            <Field label="Couleur">
              <Input placeholder="Gris, Blanc, Bleu…" value={data.couleur} onChange={e => set('couleur', e.target.value)} />
            </Field>
            <Field label="Boîte de vitesses">
              <Select value={data.boite} onChange={e => set('boite', e.target.value as 'manuelle' | 'automatique')}>
                <option value="automatique">Automatique</option>
                <option value="manuelle">Manuelle</option>
              </Select>
            </Field>
            <Field label="Distance (km depuis GP-CARS)">
              <Input type="number" min={0} value={data.distanceKm} onChange={e => set('distanceKm', parseInt(e.target.value) || 0)} />
            </Field>
          </div>

          <hr className="border-zinc-800" />
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">Prix</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prix demandé (€)">
              <Input type="number" min={0} value={data.prixDemande || ''} placeholder="ex: 17500" onChange={e => set('prixDemande', parseFloat(e.target.value) || 0)} />
            </Field>
            <Field label="Prix marché estimé (€)">
              <Input type="number" min={0} value={data.prixMarcheEstime || ''} placeholder="AutoScout24, Gocar…" onChange={e => set('prixMarcheEstime', parseFloat(e.target.value) || 0)} />
            </Field>
          </div>

          <hr className="border-zinc-800" />
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">État du véhicule</p>
          <div className="grid grid-cols-2 gap-3">
            <Check id="entretien" label="Entretien récent documenté" checked={data.entretienRecent} onChange={v => set('entretienRecent', v)} />
            <Check id="pneus" label="Pneus ≥ 50 %" checked={data.pneusOk} onChange={v => set('pneusOk', v)} />
            <Check id="freins" label="Freins corrects" checked={data.freinsOk} onChange={v => set('freinsOk', v)} />
            <Check id="carrosserie" label="Carrosserie sans défaut" checked={data.carrosseriePropre} onChange={v => set('carrosseriePropre', v)} />
            <Check id="garantie" label="Garantie constructeur restante" checked={data.garantieConstructeur} onChange={v => set('garantieConstructeur', v)} />
            <Check id="ct" label="CT valide en Belgique" checked={data.ctValide} onChange={v => set('ctValide', v)} />
          </div>

          {!data.carrosseriePropre && (
            <Field label="Devis carrosserie estimé (€)">
              <Input type="number" min={0} placeholder="ex: 800" value={data.devisCarrosserie || ''} onChange={e => set('devisCarrosserie', parseFloat(e.target.value) || 0)} />
            </Field>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!data.marque || !data.modele || !data.prixDemande || !data.prixMarcheEstime}
            className="w-full py-3 bg-white text-black text-sm font-bold rounded-lg hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Analyser — Verdict Carmelo
          </button>
        </div>

        {/* Result */}
        {result && v && (
          <div className={`${v.bg} border ${v.border} rounded-xl p-6 space-y-5`}>

            <div>
              <p className="text-xs text-zinc-500 mb-1">{result.vehicule}</p>
              <p className={`text-2xl font-bold ${v.text}`}>{v.label}</p>
              {result.raisonRefus && (
                <p className="text-red-300 text-sm mt-2">{result.raisonRefus}</p>
              )}
            </div>

            {!result.raisonRefus && (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase mb-2">Points forts</p>
                    <ul className="space-y-1">
                      {result.pointsForts.map((p, i) => <li key={i} className="text-green-300">✓ {p}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase mb-2">Points faibles</p>
                    <ul className="space-y-1">
                      {result.pointsFaibles.map((p, i) => <li key={i} className="text-yellow-300">⚠ {p}</li>)}
                    </ul>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-zinc-500 uppercase mb-2">Risques mécaniques</p>
                  <ul className="space-y-1 text-sm">
                    {result.risquesMecaniques.map((r, i) => <li key={i} className="text-zinc-300">• {r}</li>)}
                  </ul>
                </div>

                <div>
                  <p className="text-xs text-zinc-500 uppercase mb-2">Chiffres</p>
                  <div className="space-y-0">
                    <Row label="Prix marché estimé" value={euro(result.prixMarcheReel)} />
                    <Row label="Prix de vente réaliste" value={euro(result.prixVenteRealiste)} />
                    <Row label="CT + Car-Pass" value={result.fraisCT ? euro(result.fraisCT) : 'Inclus'} />
                    <Row label="Préparation" value={euro(result.fraisPreparation)} />
                    <Row label="Publicité" value={euro(result.fraisPublicite)} />
                    {result.fraisEntretien > 0 && <Row label="Entretien" value={euro(result.fraisEntretien)} />}
                    {result.fraisPneus > 0 && <Row label="Pneus" value={euro(result.fraisPneus)} />}
                    {result.fraisTransport > 0 && <Row label="Transport" value={euro(result.fraisTransport)} />}
                    {result.fraisGarantie > 0 && <Row label="Garantie" value={euro(result.fraisGarantie)} />}
                    {result.fraisCarrosserie > 0 && <Row label="Carrosserie" value={euro(result.fraisCarrosserie)} />}
                    <Row label="Total frais" value={euro(result.fraisTotal)} />
                    <Row label="Coussin négociation (3%)" value={euro(result.coussinNegociation)} />
                    <Row label="Marge cible" value={euro(result.margeCible)} />
                    <Row label="PRIX MAXIMUM À REMETTRE" value={euro(result.prixMaximum)} highlight />
                    <Row label="Marge estimée" value={`${euro(result.margeEstimee)} — zone ${result.zoneMarge}`} highlight />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Score Rotation</p>
                    <p className="text-2xl font-bold text-white">{result.scoreRotation}<span className="text-sm text-zinc-400">/10</span></p>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Délai estimé</p>
                    <p className="text-2xl font-bold text-white">{result.rotationJours}<span className="text-sm text-zinc-400">j</span></p>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Confiance</p>
                    <p className="text-2xl font-bold text-white">{result.niveauConfiance}<span className="text-sm text-zinc-400">%</span></p>
                  </div>
                </div>

                <div className="bg-zinc-900 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 uppercase mb-1">Conclusion Carmelo</p>
                  <p className="text-sm text-zinc-200 leading-relaxed">{result.conclusion}</p>
                </div>

                <p className="text-xs text-zinc-600">
                  Cohérence kilométrage : {result.coherenceKilometrage}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
