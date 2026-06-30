'use client';

import { useState } from 'react';
import type { GarageConfig } from '@/lib/carmelo/garage-config';

const inputCls = 'w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500';

function NumField({ label, value, onChange, suffix, defaultVal }: {
  label: string; value: string; onChange: (v: string) => void; suffix?: string; defaultVal: number;
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input className={inputCls} type="number" min={0} value={value} onChange={e => onChange(e.target.value)} placeholder={String(defaultVal)} />
        {suffix && <span className="text-xs text-zinc-500 shrink-0">{suffix}</span>}
      </div>
      <p className="text-[11px] text-zinc-600 mt-0.5">Défaut : {defaultVal.toLocaleString('fr-BE')}{suffix ? ` ${suffix}` : ''}</p>
    </div>
  );
}

function TagEditor({ label, tags, onChange, placeholder }: {
  label: string; tags: string[]; onChange: (t: string[]) => void; placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft('');
  };
  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-0.5 rounded">
            {t}
            <button onClick={() => onChange(tags.filter(x => x !== t))} className="text-zinc-500 hover:text-red-400">✕</button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-xs text-zinc-600">Aucun</span>}
      </div>
      <div className="flex gap-2">
        <input
          className={inputCls}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <button onClick={add} className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded shrink-0">+ Ajouter</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
      {children}
    </div>
  );
}

export default function SettingsClient({ config, hasOverrides, defaults }: {
  config: GarageConfig; hasOverrides: boolean; defaults: GarageConfig;
}) {
  const [garageName, setGarageName] = useState(config.garageName);
  const [plafondAchat, setPlafondAchat] = useState(String(config.params.plafond_achat_vehicule));
  const [budgetJour, setBudgetJour] = useState(String(config.params.budget_max_jour));
  const [seuilConfiance, setSeuilConfiance] = useState(String(config.params.seuil_confiance_autonome));
  const [coussinPct, setCoussinPct] = useState(String(config.params.coussin_negociation_client_pct));
  const [margeStdCible, setMargeStdCible] = useState(String(config.margins.standard.cible));
  const [margeStdOrange, setMargeStdOrange] = useState(String(config.margins.standard.orange_min));
  const [margePremCible, setMargePremCible] = useState(String(config.margins.premium.cible));
  const [margePremOrange, setMargePremOrange] = useState(String(config.margins.premium.orange_min));
  const [ctCarpass, setCtCarpass] = useState(String(config.costReference.ct_carpass));
  const [preparation, setPreparation] = useState(String(config.costReference.preparation_standard));
  const [publicite, setPublicite] = useState(String(config.costReference.publicite));
  const [marques, setMarques] = useState<string[]>(config.marquesPreferees);
  const [exclusions, setExclusions] = useState<string[]>(config.exclusionsAbsolues);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const plancher = (Number(ctCarpass) || 0) + (Number(preparation) || 0) + (Number(publicite) || 0);

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    const res = await fetch('/api/garage/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        garageName, plafondAchat, budgetJour, seuilConfiance, coussinPct,
        margeStdCible, margeStdOrange, margePremCible, margePremOrange,
        ctCarpass, preparation, publicite,
        marquesPreferees: marques, exclusionsAbsolues: exclusions,
      }),
    });
    setSaving(false);
    setFeedback(res.ok ? '✓ Configuration enregistrée. Les agents l\'appliquent dès la prochaine analyse.' : '✗ Erreur lors de l\'enregistrement.');
    setTimeout(() => setFeedback(null), 5000);
  };

  return (
    <div className="space-y-5">
      <div className="bg-blue-950/40 border border-blue-900 rounded-lg p-3 text-xs text-blue-300">
        {hasOverrides
          ? 'Ce garage utilise une configuration personnalisée. Les champs vides reprennent la valeur par défaut.'
          : 'Ce garage utilise la configuration par défaut. Modifiez les valeurs ci-dessous pour l\'adapter à votre activité — rien n\'est imposé.'}
      </div>

      <Section title="Identité">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Nom du garage</label>
          <input className={inputCls} value={garageName} onChange={e => setGarageName(e.target.value)} placeholder={defaults.garageName} />
          <p className="text-[11px] text-zinc-600 mt-0.5">Utilisé par les agents (analyses, communications).</p>
        </div>
      </Section>

      <Section title="Marges minimales">
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Standard — cible (< 20 000 €)" value={margeStdCible} onChange={setMargeStdCible} suffix="€" defaultVal={defaults.margins.standard.cible} />
          <NumField label="Standard — seuil rouge" value={margeStdOrange} onChange={setMargeStdOrange} suffix="€" defaultVal={defaults.margins.standard.orange_min} />
          <NumField label="Premium — cible (≥ 20 000 €)" value={margePremCible} onChange={setMargePremCible} suffix="€" defaultVal={defaults.margins.premium.cible} />
          <NumField label="Premium — seuil rouge" value={margePremOrange} onChange={setMargePremOrange} suffix="€" defaultVal={defaults.margins.premium.orange_min} />
        </div>
      </Section>

      <Section title="Paramètres opérationnels">
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Plafond d'achat / véhicule" value={plafondAchat} onChange={setPlafondAchat} suffix="€" defaultVal={defaults.params.plafond_achat_vehicule} />
          <NumField label="Budget max / jour" value={budgetJour} onChange={setBudgetJour} suffix="€" defaultVal={defaults.params.budget_max_jour} />
          <NumField label="Seuil confiance autonome" value={seuilConfiance} onChange={setSeuilConfiance} suffix="%" defaultVal={defaults.params.seuil_confiance_autonome} />
          <NumField label="Coussin négociation client" value={coussinPct} onChange={setCoussinPct} suffix="%" defaultVal={defaults.params.coussin_negociation_client_pct} />
        </div>
      </Section>

      <Section title="Frais de référence (plancher incompressible)">
        <div className="grid grid-cols-3 gap-3">
          <NumField label="CT + Car-Pass" value={ctCarpass} onChange={setCtCarpass} suffix="€" defaultVal={defaults.costReference.ct_carpass} />
          <NumField label="Préparation" value={preparation} onChange={setPreparation} suffix="€" defaultVal={defaults.costReference.preparation_standard} />
          <NumField label="Publicité" value={publicite} onChange={setPublicite} suffix="€" defaultVal={defaults.costReference.publicite} />
        </div>
        <p className="text-xs text-zinc-400">
          Plancher de frais calculé : <span className="font-semibold text-zinc-200">{plancher.toLocaleString('fr-BE')} €</span>
          <span className="text-zinc-600"> (toujours appliqué à chaque véhicule)</span>
        </p>
      </Section>

      <Section title="Marques préférées">
        <TagEditor label="Marques prioritaires à l'achat" tags={marques} onChange={setMarques} placeholder="Ex. Volkswagen" />
      </Section>

      <Section title="Exclusions absolues (refus automatique)">
        <TagEditor label="Critères qui déclenchent un refus ROUGE" tags={exclusions} onChange={setExclusions} placeholder="Ex. Moteurs PSA PureTech" />
      </Section>

      <div className="flex items-center gap-3 sticky bottom-4">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 bg-zinc-100 text-zinc-900 text-sm font-semibold rounded-lg hover:bg-white disabled:opacity-50 transition-colors shadow-lg"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer la configuration'}
        </button>
        {feedback && (
          <span className={`text-sm ${feedback.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{feedback}</span>
        )}
      </div>
    </div>
  );
}
