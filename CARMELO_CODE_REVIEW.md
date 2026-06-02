# Carmelo — Code complet pour revue

Carmelo est l'agent d'achat IA de GP-CARS (garage Francisco & Michael, Soumagne, Belgique).
Il analyse les opportunités d'achat de véhicules d'occasion et retourne un verdict : VERT (acheter), ORANGE (négocier) ou ROUGE (refuser).

L'application est construite en Next.js 14 (App Router), TypeScript, Tailwind CSS, déployée sur Vercel.
Le moteur d'analyse est entièrement côté client (pas d'API externe, pas de clé requise).

---

## Contexte métier GP-CARS

- Budget cible véhicules : 15 000 – 20 000 €
- Kilométrage max : 80 000 km
- Année minimum : 2021
- Marques préférées : Kia, Hyundai, Toyota, Volkswagen, Audi, BMW, Mercedes
- Boîte automatique prioritaire
- Marge cible : 3 000 € (véhicules < 20k€) | 4 000 € (véhicules > 25k€)
- Plancher frais incompressible : 405 € (CT 105 € + préparation 100 € + publicité 200 €)

---

## Fichier 1 : lib/carmelo/config.ts

```typescript
// Carmelo — GP-CARS purchasing agent configuration
// Update these values to reflect GP-CARS real operational costs

export const COST_REFERENCE = {
  // Always applied (incompressible floor for any vehicle in good condition)
  ct_carpass: 105,
  preparation_standard: 100,
  publicite: 200,

  // Applied only when the vehicle actually requires it
  entretien: { min: 200, max: 300 },
  transport_belgique: { min: 0, max: 200 },
  transport_import: { min: 250, max: 400 },

  // Estimated ranges for conditional items
  pneus_4: { min: 300, max: 600 },
  freins: { min: 200, max: 400 },
  garantie: { min: 300, max: 600 },

  // Carrosserie: always use real quote — never estimate
  carrosserie: 'devis_reel',
} as const;

// Incompressible floor for a vehicle in good condition
export const PLANCHER_FRAIS = 405; // ct_carpass + preparation_standard + publicite

export const COST_CHECKLIST = [
  'entretien_recent_documente',
  'pneus_50_pct_min',
  'freins_corrects',
  'carrosserie_sans_defaut',
  'garantie_constructeur_restante',
  'ct_valide_belgique',
  'distance_transport_km',
] as const;

export const MARGES = {
  // Vehicles 5,000 – 20,000 €
  standard: {
    cible: 3000,
    orange_min: 2500,
    rouge_seuil: 2500,
  },
  // Vehicles > 25,000 € (20k–25k defaults to premium tier)
  premium: {
    cible: 4000,
    orange_min: 3500,
    rouge_seuil: 3500,
  },
} as const;

// Score rotation thresholds
export const ROTATION = {
  tres_liquide: { min: 9, max: 10, delai_jours: 30 },
  liquide: { min: 7, max: 8, delai_jours: 60 },
  moyen: { min: 5, max: 6, delai_jours: 90 },
  lent: { min: 0, max: 4, delai_jours: 120 },
} as const;

// Configurable operational parameters — fill in GP-CARS real values
export const GP_CARS_PARAMS = {
  plafond_achat_vehicule: null as number | null,  // e.g. 25000
  budget_max_jour: null as number | null,          // e.g. 40000
  seuil_confiance_autonome: null as number | null, // e.g. 85 (percent)
  coussin_negociation_client_pct: 3,               // 3–5% of sale price
};

// Preferred brands (subject to profitability check)
export const MARQUES_PREFEREES = [
  'Kia', 'Hyundai', 'Toyota', 'Volkswagen', 'Audi', 'BMW', 'Mercedes',
] as const;

// Absolute exclusions
export const EXCLUSIONS_ABSOLUES = [
  'Moteurs PSA PureTech',
  'Historique douteux',
  'Kilométrage incohérent',
  'Entretien absent ou non documenté',
  'Import douteux avec historique incomplet',
  'Véhicule accidenté lourdement',
  'Couleur difficile (rouge, beige, atypique)',
  'Modèle à risque mécanique connu élevé',
  'Marge cible non atteignable',
] as const;
```

---

## Fichier 2 : lib/carmelo/analyzer.ts

```typescript
export interface VehicleData {
  marque: string;
  modele: string;
  annee: number;
  kilometrage: number;
  motorisation: string;
  boite: 'manuelle' | 'automatique';
  couleur: string;
  prixDemande: number;
  prixMarcheEstime: number;
  entretienRecent: boolean;
  pneusOk: boolean;
  freinsOk: boolean;
  carrosseriePropre: boolean;
  garantieConstructeur: boolean;
  ctValide: boolean;
  distanceKm: number;
  devisCarrosserie: number;
}

export interface CarmeloResult {
  vehicule: string;
  decision: 'VERT' | 'ORANGE' | 'ROUGE';
  raisonRefus: string;
  pointsForts: string[];
  pointsFaibles: string[];
  risquesMecaniques: string[];
  risquesCommerciaux: string[];
  coherenceKilometrage: string;
  prixMarcheReel: number;
  prixVenteRealiste: number;
  fraisCT: number;
  fraisPreparation: number;
  fraisPublicite: number;
  fraisEntretien: number;
  fraisPneus: number;
  fraisTransport: number;
  fraisGarantie: number;
  fraisCarrosserie: number;
  fraisTotal: number;
  coussinNegociation: number;
  margeCible: number;
  prixMaximum: number;
  margeEstimee: number;
  zoneMarge: 'verte' | 'orange' | 'rouge';
  scoreRotation: number;
  rotationJours: number;
  niveauConfiance: number;
  conclusion: string;
}

const MARQUES_PREFEREES = ['kia', 'hyundai', 'toyota', 'volkswagen', 'vw', 'audi', 'bmw', 'mercedes'];
const COULEURS_DIFFICILES = ['rouge', 'red', 'beige', 'orange', 'jaune', 'yellow', 'vert', 'green', 'violet', 'rose', 'pink'];

function isPureTech(motorisation: string): boolean {
  const m = motorisation.toLowerCase();
  return m.includes('puretech') || (m.includes('1.0') && m.includes('psa')) || (m.includes('1.2') && m.includes('psa'));
}

function isCouleurDifficile(couleur: string): boolean {
  const c = couleur.toLowerCase();
  return COULEURS_DIFFICILES.some(d => c.includes(d));
}

function getRotationScore(data: VehicleData): number {
  let score = 7;
  const marque = data.marque.toLowerCase();

  if (['kia', 'hyundai', 'toyota'].some(m => marque.includes(m))) score += 1;
  if (['volkswagen', 'vw', 'golf', 'polo'].some(m => marque.includes(m) || data.modele.toLowerCase().includes(m))) score += 1;
  if (['bmw', 'mercedes', 'audi'].some(m => marque.includes(m))) score += 0;

  if (data.boite === 'automatique') score += 1;
  if (data.boite === 'manuelle') score -= 1;

  if (isCouleurDifficile(data.couleur)) score -= 2;

  if (data.kilometrage < 30000) score += 1;
  if (data.kilometrage > 60000) score -= 1;

  if (data.annee >= 2023) score += 1;
  if (data.annee <= 2021) score -= 1;

  if (data.garantieConstructeur) score += 1;

  return Math.max(1, Math.min(10, score));
}

function getRotationJours(score: number): number {
  if (score >= 9) return 20;
  if (score >= 7) return 45;
  if (score >= 5) return 75;
  return 100;
}

function calculerFrais(data: VehicleData) {
  const ct = data.ctValide ? 0 : 105;
  const preparation = 100;
  const publicite = 200;
  const entretien = data.entretienRecent ? 0 : 250;
  const pneus = data.pneusOk ? 0 : 450;
  const freins = data.freinsOk ? 0 : 0; // inclus dans entretien
  const transport = data.distanceKm < 50 ? 0 : data.distanceKm < 200 ? 150 : 350;
  const garantie = data.garantieConstructeur ? 0 : 400;
  const carrosserie = data.carrosseriePropre ? 0 : data.devisCarrosserie;
  const total = ct + preparation + publicite + entretien + pneus + transport + garantie + carrosserie;
  return { ct, preparation, publicite, entretien, pneus, transport, garantie, carrosserie, total };
}

function getMargeCible(prixVente: number): number {
  return prixVente >= 25000 ? 4000 : 3000;
}

export function analyzeVehicle(data: VehicleData): CarmeloResult {
  const vehicule = `${data.marque} ${data.modele} ${data.annee} / ${data.kilometrage.toLocaleString('fr')} km / ${data.motorisation}`;

  // — Exclusions absolues —
  if (isPureTech(data.motorisation)) {
    return refus(vehicule, 'Moteur PSA PureTech — exclusion absolue GP-CARS. Fiabilité insuffisante.', data);
  }
  if (data.annee < 2021) {
    return refus(vehicule, `Véhicule trop ancien (${data.annee}) — critère minimum 2021.`, data);
  }
  if (data.kilometrage > 80000) {
    return refus(vehicule, `Kilométrage trop élevé (${data.kilometrage.toLocaleString('fr')} km) — maximum 80 000 km.`, data);
  }

  const frais = calculerFrais(data);
  const prixVenteRealiste = data.prixMarcheEstime * 0.97;
  const margeCible = getMargeCible(prixVenteRealiste);
  const coussin = Math.round(prixVenteRealiste * 0.03);
  const prixMaximum = Math.round(prixVenteRealiste - margeCible - frais.total - coussin);
  const margeEstimee = prixVenteRealiste - data.prixDemande - frais.total - coussin;
  const scoreRotation = getRotationScore(data);
  const rotationJours = getRotationJours(scoreRotation);

  const pointsForts: string[] = [];
  const pointsFaibles: string[] = [];
  const risquesMecaniques: string[] = [];
  const risquesCommerciaux: string[] = [];

  // Points forts
  if (data.garantieConstructeur) pointsForts.push('Garantie constructeur restante');
  if (data.entretienRecent) pointsForts.push('Entretien récent documenté');
  if (data.boite === 'automatique') pointsForts.push('Boîte automatique — forte demande');
  if (data.carrosseriePropre) pointsForts.push('Carrosserie sans défaut');
  if (data.kilometrage < 40000) pointsForts.push('Kilométrage bas');
  if (data.annee >= 2023) pointsForts.push('Véhicule récent');
  if (data.ctValide) pointsForts.push('CT valide — pas de frais');
  if (MARQUES_PREFEREES.some(m => data.marque.toLowerCase().includes(m))) pointsForts.push('Marque recherchée sur le marché belge');

  // Points faibles
  if (!data.entretienRecent) pointsFaibles.push('Entretien à prévoir — frais certains');
  if (!data.pneusOk) pointsFaibles.push('Pneus à remplacer');
  if (!data.carrosseriePropre) pointsFaibles.push('Carrosserie à reprendre');
  if (isCouleurDifficile(data.couleur)) pointsFaibles.push(`Couleur difficile (${data.couleur}) — délai de vente allongé`);
  if (data.boite === 'manuelle') pointsFaibles.push('Boîte manuelle — demande plus faible');
  if (!data.garantieConstructeur) pointsFaibles.push('Hors garantie constructeur');
  if (data.kilometrage > 60000) pointsFaibles.push('Kilométrage élevé');

  // Risques mécaniques
  const mot = data.motorisation.toLowerCase();
  if (mot.includes('1.0') || mot.includes('1.2')) risquesMecaniques.push('Petit moteur — surveiller turbo et chaîne');
  if (mot.includes('diesel') && data.kilometrage > 50000) risquesMecaniques.push('Diesel > 50 000 km — surveiller FAP et injection');
  if (data.marque.toLowerCase().includes('bmw') || data.marque.toLowerCase().includes('mercedes')) {
    risquesMecaniques.push('Marque premium — coûts de réparation élevés hors garantie');
  }
  if (risquesMecaniques.length === 0) risquesMecaniques.push('Aucun risque mécanique majeur identifié');

  // Risques commerciaux
  if (isCouleurDifficile(data.couleur)) risquesCommerciaux.push('Couleur peu recherchée — immobilisation probable');
  if (scoreRotation < 6) risquesCommerciaux.push('Rotation lente estimée — risque d\'immobilisation');
  if (data.prixDemande > prixMaximum) risquesCommerciaux.push('Prix demandé supérieur au maximum — négociation impérative');
  if (risquesCommerciaux.length === 0) risquesCommerciaux.push('Aucun risque commercial majeur identifié');

  // Cohérence kilométrage
  const kmParAn = data.kilometrage / Math.max(1, 2025 - data.annee);
  let coherence = '';
  if (kmParAn < 5000) coherence = 'SUSPECT — kilométrage anormalement bas, vérifier historique';
  else if (kmParAn < 25000) coherence = 'OUI — kilométrage cohérent';
  else if (kmParAn < 35000) coherence = 'OUI — kilométrage légèrement élevé mais acceptable';
  else coherence = 'ÉLEVÉ — usage intensif, surveiller l\'état mécanique';

  // Zone marge et verdict
  let zoneMarge: 'verte' | 'orange' | 'rouge';
  let decision: 'VERT' | 'ORANGE' | 'ROUGE';
  let conclusion = '';
  let niveauConfiance = 70;

  if (data.garantieConstructeur && data.entretienRecent) niveauConfiance += 15;
  if (data.carrosseriePropre && data.pneusOk) niveauConfiance += 10;
  if (data.prixMarcheEstime === 0) niveauConfiance -= 20;

  if (margeEstimee >= margeCible) {
    zoneMarge = 'verte';
  } else if (margeEstimee >= margeCible * 0.85) {
    zoneMarge = 'orange';
  } else {
    zoneMarge = 'rouge';
  }

  if (zoneMarge === 'verte' && scoreRotation >= 6) {
    decision = 'VERT';
    conclusion = `Bonne affaire. Marge en zone verte (${Math.round(margeEstimee).toLocaleString('fr')} €) avec rotation estimée à ${rotationJours} jours. Acquérir si le prix demandé (${data.prixDemande.toLocaleString('fr')} €) est négociable à ${prixMaximum.toLocaleString('fr')} € maximum.`;
  } else if (zoneMarge === 'orange' && scoreRotation >= 7) {
    decision = 'ORANGE';
    conclusion = `Véhicule intéressant mais marge limite (${Math.round(margeEstimee).toLocaleString('fr')} €). Acceptable uniquement si négociation jusqu'à ${prixMaximum.toLocaleString('fr')} € et rotation confirmée rapide.`;
  } else if (data.prixDemande > prixMaximum) {
    decision = 'ORANGE';
    conclusion = `Prix demandé (${data.prixDemande.toLocaleString('fr')} €) trop élevé. Négocier impérativement à ${prixMaximum.toLocaleString('fr')} € maximum pour atteindre la marge cible.`;
  } else {
    decision = 'ROUGE';
    conclusion = `Marge insuffisante (${Math.round(margeEstimee).toLocaleString('fr')} €) — en dessous du seuil GP-CARS. Passer au suivant ou faire une offre très basse.`;
  }

  return {
    vehicule,
    decision,
    raisonRefus: '',
    pointsForts,
    pointsFaibles,
    risquesMecaniques,
    risquesCommerciaux,
    coherenceKilometrage: coherence,
    prixMarcheReel: data.prixMarcheEstime,
    prixVenteRealiste: Math.round(prixVenteRealiste),
    fraisCT: frais.ct,
    fraisPreparation: frais.preparation,
    fraisPublicite: frais.publicite,
    fraisEntretien: frais.entretien,
    fraisPneus: frais.pneus,
    fraisTransport: frais.transport,
    fraisGarantie: frais.garantie,
    fraisCarrosserie: frais.carrosserie,
    fraisTotal: frais.total,
    coussinNegociation: coussin,
    margeCible,
    prixMaximum,
    margeEstimee: Math.round(margeEstimee),
    zoneMarge,
    scoreRotation,
    rotationJours,
    niveauConfiance: Math.min(95, niveauConfiance),
    conclusion,
  };
}

function refus(vehicule: string, raison: string, data: VehicleData): CarmeloResult {
  return {
    vehicule,
    decision: 'ROUGE',
    raisonRefus: raison,
    pointsForts: [],
    pointsFaibles: [],
    risquesMecaniques: [],
    risquesCommerciaux: [],
    coherenceKilometrage: '—',
    prixMarcheReel: 0,
    prixVenteRealiste: 0,
    fraisCT: 0,
    fraisPreparation: 0,
    fraisPublicite: 0,
    fraisEntretien: 0,
    fraisPneus: 0,
    fraisTransport: 0,
    fraisGarantie: 0,
    fraisCarrosserie: 0,
    fraisTotal: 0,
    coussinNegociation: 0,
    margeCible: 0,
    prixMaximum: 0,
    margeEstimee: 0,
    zoneMarge: 'rouge',
    scoreRotation: 0,
    rotationJours: 0,
    niveauConfiance: 100,
    conclusion: raison,
  };
}
```

---

## Fichier 3 : app/carmelo/page.tsx

```tsx
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

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carmelo — GP-CARS</h1>
          <p className="text-zinc-400 text-sm mt-1">Directeur des Achats · Analyse de véhicule</p>
        </div>

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
```

---

## Points d'amélioration discutés avec GP-CARS

1. **Données marché en temps réel** — Actuellement, le prix marché est entré manuellement. Objectif : Carmelo va chercher automatiquement les prix sur AutoScout24, Gocar et 2dehands via une URL ou une recherche (nécessite API Anthropic avec recherche web).

2. **Recoupement multi-sources** — Croiser plusieurs plateformes pour détecter les anomalies de prix (trop bas = problème caché, trop haut = invendable).

3. **Score de rotation amélioré** — Intégrer la saisonnalité belge et l'historique réel de ventes GP-CARS pour calibrer les estimations de délai.

4. **Historique des analyses** — Conserver une trace de chaque véhicule analysé, avec le résultat réel (acheté/refusé, vendu en X jours, marge réelle vs estimée).

5. **Liste des moteurs à risque** — Étendre les exclusions mécaniques (actuellement seulement PureTech) à d'autres moteurs à risque connus.

6. **Apprentissage par les résultats** — Permettre à Carmelo de se calibrer sur les données réelles de GP-CARS au fil du temps.
