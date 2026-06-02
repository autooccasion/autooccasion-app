'use client';

import { useState } from 'react';
import { analyzeVehicle, VehicleData, CarmeloResult } from '@/lib/carmelo/analyzer';

const VERDICT_STYLE = {
  VERT:   { bg: 'bg-green-950',  border: 'border-green-700',  text: 'text-green-300',  label: '🟢 VERT — ACHETER' },
  ORANGE: { bg: 'bg-yellow-950', border: 'border-yellow-700', text: 'text-yellow-300', label: '🟠 ORANGE — NÉGOCIER' },
  ROUGE:  { bg: 'bg-red-950',    border: 'border-red-700',    text: 'text-red-300',    label: '🔴 ROUGE — REFUSER' },
};

const RISQUE_STYLE: Record<string, string> = {
  blacklist:  'text-red-400',
  eleve:      'text-orange-400',
  modere:     'text-yellow-400',
  faible:     'text-green-400',
  excellent:  'text-emerald-400',
};

const RISQUE_LABEL: Record<string, string> = {
  blacklist:  'BLACKLIST',
  eleve:      'ÉLEVÉ',
  modere:     'MODÉRÉ',
  faible:     'FAIBLE',
  excellent:  'EXCELLENT',
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
    typeVehicule: 'suv',
    finition: '',
    codeMoteur: '',
    paysOrigine: 'BE',
    prixDemande: 0, prixMarcheEstime: 0, prixVNReference: 0,
    entretienRecent: true, pneusOk: true, freinsOk: true,
    carrosseriePropre: true, garantieConstructeur: false,
    ctValide: false, distanceKm: 50,
  });

  const [result, setResult] = useState<CarmeloResult | null>(null);

  function set<K extends keyof VehicleData>(key: K, value: VehicleData[K]) {
    setData(prev => ({ ...prev, [key]: value }));
    setResult(null);
  }

  function handleAnalyze() {
    const payload: VehicleData = {
      ...data,
      prixVNReference: data.prixVNReference && data.prixVNReference > 0 ? data.prixVNReference : undefined,
      codeMoteur:  data.codeMoteur  || undefined,
      finition:    data.finition    || undefined,
    };
    setResult(analyzeVehicle(payload));
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
            <Field label="Code moteur (optionnel)">
              <Input placeholder="N47, EA211, B47…" value={data.codeMoteur ?? ''} onChange={e => set('codeMoteur', e.target.value)} />
            </Field>
            <Field label="Couleur">
              <Input placeholder="Gris, Blanc, Bleu…" value={data.couleur} onChange={e => set('couleur', e.target.value)} />
            </Field>
            <Field label="Finition (optionnel)">
              <Input placeholder="GTI, AMG Line, Sport…" value={data.finition ?? ''} onChange={e => set('finition', e.target.value)} />
            </Field>
            <Field label="Type de véhicule">
              <Select value={data.typeVehicule} onChange={e => set('typeVehicule', e.target.value as VehicleData['typeVehicule'])}>
                <option value="citadine">Citadine</option>
                <option value="berline">Berline</option>
                <option value="suv">SUV</option>
                <option value="break">Break</option>
                <option value="sportive">Sportive</option>
                <option value="utilitaire">Utilitaire</option>
                <option value="autre">Autre</option>
              </Select>
            </Field>
            <Field label="Boîte de vitesses">
              <Select value={data.boite} onChange={e => set('boite', e.target.value as 'manuelle' | 'automatique')}>
                <option value="automatique">Automatique</option>
                <option value="manuelle">Manuelle</option>
              </Select>
            </Field>
            <Field label="Pays d'origine">
              <Select value={data.paysOrigine} onChange={e => set('paysOrigine', e.target.value as VehicleData['paysOrigine'])}>
                <option value="BE">Belgique</option>
                <option value="FR">France</option>
                <option value="DE">Allemagne</option>
                <option value="NL">Pays-Bas</option>
                <option value="LU">Luxembourg</option>
                <option value="autre">Autre</option>
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
            <div className="col-span-2">
              <Field label="Prix VN remisé comparable (€) — optionnel">
                <Input type="number" min={0} value={data.prixVNReference || ''} placeholder="ex: 22000 — laisser vide si inconnu" onChange={e => set('prixVNReference', parseFloat(e.target.value) || 0)} />
              </Field>
            </div>
          </div>

          <hr className="border-zinc-800" />
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">État du véhicule</p>
          <div className="grid grid-cols-2 gap-3">
            <Check id="entretien"  label="Entretien récent documenté"    checked={data.entretienRecent}    onChange={v => set('entretienRecent', v)} />
            <Check id="pneus"      label="Pneus ≥ 50 %"                  checked={data.pneusOk}            onChange={v => set('pneusOk', v)} />
            <Check id="freins"     label="Freins corrects"               checked={data.freinsOk}           onChange={v => set('freinsOk', v)} />
            <Check id="carrosserie" label="Carrosserie sans défaut"      checked={data.carrosseriePropre}  onChange={v => set('carrosseriePropre', v)} />
            <Check id="garantie"   label="Garantie constructeur restante" checked={data.garantieConstructeur} onChange={v => set('garantieConstructeur', v)} />
            <Check id="ct"         label="CT valide en Belgique"         checked={data.ctValide}           onChange={v => set('ctValide', v)} />
          </div>

          {/* Conditional devis fields */}
          <div className="space-y-4">
            {!data.entretienRecent && (
              <Field label="Devis entretien estimé (€)">
                <Input type="number" min={0} placeholder="ex: 300 — laisser vide pour défaut 250€" value={data.devisEntretien || ''} onChange={e => set('devisEntretien', parseFloat(e.target.value) || undefined as unknown as number)} />
              </Field>
            )}
            {!data.pneusOk && (
              <Field label="Devis pneus estimé (€)">
                <Input type="number" min={0} placeholder="ex: 500 — laisser vide pour défaut 450€" value={data.devisPneus || ''} onChange={e => set('devisPneus', parseFloat(e.target.value) || undefined as unknown as number)} />
              </Field>
            )}
            {!data.freinsOk && (
              <Field label="Devis freins estimé (€)">
                <Input type="number" min={0} placeholder="ex: 350 — laisser vide pour défaut 300€" value={data.devisFreins || ''} onChange={e => set('devisFreins', parseFloat(e.target.value) || undefined as unknown as number)} />
              </Field>
            )}
            {!data.carrosseriePropre && (
              <Field label="Devis carrosserie estimé (€)">
                <Input type="number" min={0} placeholder="ex: 800" value={data.devisCarrosserie || ''} onChange={e => set('devisCarrosserie', parseFloat(e.target.value) || 0)} />
              </Field>
            )}
          </div>

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
                {/* Alertes */}
                {result.alertes.length > 0 && (
                  <div className="space-y-2">
                    {result.alertes.map((alerte, i) => (
                      <div key={i} className="bg-yellow-950 border border-yellow-700 rounded-lg px-4 py-2 text-sm text-yellow-200">
                        ⚠ {alerte}
                      </div>
                    ))}
                  </div>
                )}

                {/* Points forts / faibles */}
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

                {/* Risques mécaniques */}
                <div>
                  <p className="text-xs text-zinc-500 uppercase mb-2">Risques mécaniques</p>
                  <div className="space-y-3">
                    {result.risquesMecaniques.map((r, i) => (
                      <div key={i} className="bg-zinc-900 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-zinc-200">{r.moteur}</span>
                          <span className={`text-xs font-bold ${RISQUE_STYLE[r.niveauRisque] ?? 'text-zinc-400'}`}>
                            {RISQUE_LABEL[r.niveauRisque] ?? r.niveauRisque} · Fiabilité {r.fiabilite}/5
                          </span>
                        </div>
                        <ul className="space-y-0.5">
                          {r.defautsConnus.map((d, j) => (
                            <li key={j} className="text-xs text-zinc-400">• {d}</li>
                          ))}
                        </ul>
                        {r.coutRisqueMoyen > 0 && (
                          <p className="text-xs text-zinc-500 mt-1">Coût risque estimé : {euro(r.coutRisqueMoyen)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comparaison VN */}
                {result.comparaisonVN && (
                  <div className={`rounded-lg p-4 border ${result.comparaisonVN.penalise ? 'bg-red-950 border-red-800' : 'bg-zinc-900 border-zinc-700'}`}>
                    <p className="text-xs text-zinc-500 uppercase mb-1">Comparaison VN remisé</p>
                    <p className="text-sm text-zinc-200">{result.comparaisonVN.explication}</p>
                    <div className="flex gap-4 mt-2 text-xs text-zinc-400">
                      <span>Prix VN réf. : {euro(result.comparaisonVN.prixVNReference)}</span>
                      <span>Écart : {euro(result.comparaisonVN.ecartEuros)} ({result.comparaisonVN.ecartPct}%)</span>
                    </div>
                  </div>
                )}

                {/* Chiffres */}
                <div>
                  <p className="text-xs text-zinc-500 uppercase mb-2">Chiffres</p>
                  <div className="space-y-0">
                    <Row label="Prix marché estimé"       value={euro(result.prixMarcheReel)} />
                    <Row label="Prix de vente réaliste"   value={euro(result.prixVenteRealiste)} />
                    <Row label="CT + Car-Pass"            value={result.fraisDetail.ct ? euro(result.fraisDetail.ct) : 'Inclus'} />
                    <Row label="Préparation"              value={euro(result.fraisDetail.preparation)} />
                    <Row label="Publicité"                value={euro(result.fraisDetail.publicite)} />
                    {result.fraisDetail.entretien > 0 && <Row label="Entretien"  value={euro(result.fraisDetail.entretien)} />}
                    {result.fraisDetail.pneus     > 0 && <Row label="Pneus"      value={euro(result.fraisDetail.pneus)} />}
                    {result.fraisDetail.freins    > 0 && <Row label="Freins"     value={euro(result.fraisDetail.freins)} />}
                    {result.fraisDetail.transport > 0 && <Row label="Transport"  value={euro(result.fraisDetail.transport)} />}
                    {result.fraisDetail.carrosserie > 0 && <Row label="Carrosserie" value={euro(result.fraisDetail.carrosserie)} />}
                    <Row label="Total frais"              value={euro(result.fraisDetail.total)} />
                    <Row label="Coussin négociation (3%)" value={euro(result.coussinNegociation)} />
                    <Row label="Marge cible"              value={euro(result.margeCible)} />
                    <Row label="Prix achat cible"         value={euro(result.prixAchatCible)} />
                    <Row label="Prix achat probable"      value={euro(result.prixAchatProbable)} />
                    <Row label="PRIX MAXIMUM ABSOLU"      value={euro(result.prixAchatMaximum)} highlight />
                  </div>
                </div>

                {/* Scénarios de marge */}
                <div>
                  <p className="text-xs text-zinc-500 uppercase mb-2">Scénarios de marge — zone <span className={result.zoneMarge === 'verte' ? 'text-green-400' : result.zoneMarge === 'orange' ? 'text-yellow-400' : result.zoneMarge === 'exceptionnelle' ? 'text-orange-400' : 'text-red-400'}>{result.zoneMarge}</span></p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-zinc-900 rounded-lg p-3 text-center">
                      <p className="text-xs text-zinc-500 mb-1">Pessimiste</p>
                      <p className={`text-lg font-bold ${result.marges.pessimiste >= 0 ? 'text-white' : 'text-red-400'}`}>{euro(result.marges.pessimiste)}</p>
                      <p className="text-xs text-zinc-600">achat au prix demandé</p>
                    </div>
                    <div className="bg-zinc-900 rounded-lg p-3 text-center">
                      <p className="text-xs text-zinc-500 mb-1">Réaliste</p>
                      <p className={`text-lg font-bold ${result.marges.realiste >= result.margeCible ? 'text-green-400' : 'text-yellow-400'}`}>{euro(result.marges.realiste)}</p>
                      <p className="text-xs text-zinc-600">achat probable</p>
                    </div>
                    <div className="bg-zinc-900 rounded-lg p-3 text-center">
                      <p className="text-xs text-zinc-500 mb-1">Optimiste</p>
                      <p className="text-lg font-bold text-green-400">{euro(result.marges.optimiste)}</p>
                      <p className="text-xs text-zinc-600">achat cible</p>
                    </div>
                  </div>
                </div>

                {/* Scores */}
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Rotation</p>
                    <p className="text-2xl font-bold text-white">{result.scoreRotation.valeur}<span className="text-sm text-zinc-400">/10</span></p>
                    <p className="text-xs text-zinc-600 mt-0.5">{result.scoreRotation.categorie.replace('_', ' ')}</p>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Délai estimé</p>
                    <p className="text-2xl font-bold text-white">{result.scoreRotation.delaiEstimeJours}<span className="text-sm text-zinc-400">j</span></p>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Capital immo.</p>
                    <p className={`text-2xl font-bold ${result.scoreCapitalImmobilise >= 7 ? 'text-red-400' : result.scoreCapitalImmobilise >= 5 ? 'text-yellow-400' : 'text-green-400'}`}>{result.scoreCapitalImmobilise}<span className="text-sm text-zinc-400">/10</span></p>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Confiance</p>
                    <p className="text-2xl font-bold text-white">{result.niveauConfiance}<span className="text-sm text-zinc-400">%</span></p>
                  </div>
                </div>

                {/* Conclusion */}
                <div className="bg-zinc-900 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 uppercase mb-1">Conclusion Carmelo</p>
                  <p className="text-sm text-zinc-200 leading-relaxed">{result.conclusion}</p>
                </div>

                {/* Action recommandée */}
                <div className={`rounded-lg p-4 border-2 ${result.decision === 'VERT' ? 'bg-green-950 border-green-600' : result.decision === 'ORANGE' ? 'bg-yellow-950 border-yellow-600' : 'bg-red-950 border-red-600'}`}>
                  <p className="text-xs text-zinc-400 uppercase mb-1 font-semibold">Action recommandée</p>
                  <p className={`text-sm font-medium leading-relaxed ${v.text}`}>{result.actionRecommandee}</p>
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
