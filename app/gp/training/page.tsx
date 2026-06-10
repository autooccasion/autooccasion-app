import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import { getVehicles, getLeads, getAnalyses } from 'app/db';
import GPNav from '../nav';
import Link from 'next/link';
import { MARQUES_PREFEREES, EXCLUSIONS_ABSOLUES, GP_CARS_PARAMS, MARGES, PLANCHER_FRAIS } from '@/lib/carmelo/config';

export const dynamic = 'force-dynamic';

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={ok ? 'text-green-400' : 'text-red-400'}>{ok ? '✓' : '✗'}</span>
      <span className={`text-sm ${ok ? 'text-zinc-300' : 'text-zinc-500'}`}>{label}</span>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-bold text-zinc-100 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function TrainingPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const email = session.user.email;

  const [vehicles, leads, analyses] = await Promise.all([
    getVehicles(email, 500).catch(() => []),
    getLeads(500).catch(() => []),
    getAnalyses(email, 500).catch(() => []),
  ]);

  const vendus     = vehicles.filter((v) => v.status === 'vendu');
  const enStock    = vehicles.filter((v) => ['en_stock', 'publie'].includes(v.status ?? ''));
  const withFeedback = vehicles.filter((v) => v.analysisFeedback != null);
  const leadsRouge = leads.filter((l) => l.priority === 'ROUGE');
  const leadsConclu = leads.filter((l) => l.status === 'conclu');

  // Env var checks via headers presence (best effort client-side simulation)
  const hasApiKey  = !!process.env.ANTHROPIC_API_KEY;
  const hasNotify  = !!process.env.NOTIFY_EMAIL;
  const hasResend  = !!process.env.RESEND_API_KEY;
  const hasScraper = !!process.env.SCRAPERAPI_KEY;
  const hasCron    = !!process.env.CRON_SECRET;

  const memoryScore = Math.min(100, Math.round(
    (Math.min(vendus.length, 20) / 20) * 50 +
    (Math.min(withFeedback.length, 10) / 10) * 30 +
    (Math.min(analyses.length, 20) / 20) * 20
  ));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-5xl space-y-8">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Formation & Entraînement</h1>
          <p className="text-sm text-zinc-400 mt-1">Vérifiez la santé des agents et entraînez-les avec des données réelles.</p>
        </div>

        <GPNav active="training" />

        {/* Statut configuration */}
        <Section title="Configuration — Variables d'environnement">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Check ok={hasApiKey}  label="ANTHROPIC_API_KEY — IA (Carmelo + MADORE)" />
            <Check ok={hasNotify}  label={`NOTIFY_EMAIL — ${process.env.NOTIFY_EMAIL || 'non configuré'}`} />
            <Check ok={hasResend}  label="RESEND_API_KEY — Emails alertes + digest" />
            <Check ok={hasScraper} label="SCRAPERAPI_KEY — Scanner anti-bot" />
            <Check ok={hasCron}    label="CRON_SECRET — Crons sécurisés" />
          </div>
          {(!hasApiKey || !hasNotify) && (
            <p className="text-xs text-red-400 mt-3">
              ⚠️ Les variables manquantes (✗) bloquent le fonctionnement des agents. Configurez-les dans Vercel → Settings → Environment Variables.
            </p>
          )}
        </Section>

        {/* Mémoire Carmelo */}
        <Section title="Mémoire de Carmelo">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Véhicules analysés" value={analyses.length} sub="Historique analyses" />
            <Stat label="Véhicules vendus" value={vendus.length} sub="Résultats réels" />
            <Stat label="Feedbacks donnés" value={withFeedback.length} sub="👍 / 👎 corrections" />
            <Stat label="Score mémoire" value={`${memoryScore} / 100`} sub={memoryScore < 50 ? 'Insuffisant — importer des données' : memoryScore < 80 ? 'Correct' : 'Excellent'} />
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide">Comment améliorer la mémoire :</p>
            <div className="space-y-1.5 text-sm text-zinc-400">
              <p className={vendus.length >= 10 ? 'text-green-400' : ''}>
                {vendus.length >= 10 ? '✓' : '○'} Importer l&apos;historique des ventes GP-CARS via{' '}
                <Link href="/carmelo/import" className="underline text-zinc-200">Import CSV</Link>
                {vendus.length < 10 && <span className="text-yellow-400"> — {10 - vendus.length} ventes supplémentaires recommandées</span>}
              </p>
              <p className={withFeedback.length >= 5 ? 'text-green-400' : ''}>
                {withFeedback.length >= 5 ? '✓' : '○'} Corriger les analyses avec 👍/👎 dans{' '}
                <Link href="/gp/stock" className="underline text-zinc-200">le stock</Link>
                {withFeedback.length < 5 && <span className="text-yellow-400"> — au moins 5 corrections recommandées</span>}
              </p>
              <p className={analyses.length >= 10 ? 'text-green-400' : ''}>
                {analyses.length >= 10 ? '✓' : '○'} Analyser des véhicules réels via{' '}
                <Link href="/carmelo" className="underline text-zinc-200">Carmelo</Link>
              </p>
            </div>
          </div>
        </Section>

        {/* MADORE */}
        <Section title="MADORE — Agent commercial">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Leads reçus" value={leads.length} />
            <Stat label="Très chauds" value={leadsRouge.length} sub="Priorité ROUGE" />
            <Stat label="Conclus" value={leadsConclu.length} sub="Ventes confirmées" />
            <Stat label="Stock visible" value={enStock.length} sub="Véhicules proposables" />
          </div>

          <div className="mt-4 p-4 bg-yellow-950 border border-yellow-800 rounded-lg space-y-2">
            <p className="text-sm font-semibold text-yellow-300">⚙️ Tester MADORE sans créer de vrais leads</p>
            <p className="text-xs text-zinc-400">
              Utilisez le mode démo pour simuler des conversations prospects, vérifier les réponses
              et vous assurer que le stock est bien présenté. Aucune donnée n&apos;est sauvegardée.
            </p>
            <Link
              href="/madore?demo=true"
              className="inline-block mt-2 px-4 py-2 bg-yellow-900 border border-yellow-700 text-yellow-200 text-sm font-semibold rounded-lg hover:bg-yellow-800 transition-colors"
            >
              Lancer MADORE en mode test →
            </Link>
          </div>

          <div className="mt-4 space-y-1.5 text-sm text-zinc-400">
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide mb-2">Scénarios de test recommandés :</p>
            <p>○ Prospect familial, budget 18 000 €, cherche SUV automatique</p>
            <p>○ Prospect seul, budget 12 000 €, citadine économique</p>
            <p>○ Prospect avec reprise, budget 22 000 €, délai immédiat</p>
            <p>○ Prospect hors budget (trop bas ou trop élevé)</p>
            <p>○ Prospect qui refuse de donner son téléphone</p>
          </div>
        </Section>

        {/* Paramètres Carmelo */}
        <Section title="Paramètres Carmelo — Configuration active">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <Param label="Plafond achat / véhicule" value={`${GP_CARS_PARAMS.plafond_achat_vehicule.toLocaleString('fr-BE')} €`} />
            <Param label="Budget max / jour" value={`${GP_CARS_PARAMS.budget_max_jour.toLocaleString('fr-BE')} €`} />
            <Param label="Seuil confiance autonome" value={`${GP_CARS_PARAMS.seuil_confiance_autonome} %`} />
            <Param label="Marge cible (standard)" value={`${MARGES.standard.cible.toLocaleString('fr-BE')} €`} />
            <Param label="Marge cible (premium)" value={`${MARGES.premium.cible.toLocaleString('fr-BE')} €`} />
            <Param label="Frais incompressibles" value={`${PLANCHER_FRAIS} €`} />
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Marques préférées</p>
              <div className="flex flex-wrap gap-1">
                {MARQUES_PREFEREES.map((m) => (
                  <span key={m} className="text-xs px-2 py-0.5 bg-green-950 border border-green-800 text-green-300 rounded-full">{m}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Exclusions absolues</p>
              <ul className="space-y-0.5">
                {EXCLUSIONS_ABSOLUES.map((e) => (
                  <li key={e} className="text-xs text-red-400">✗ {e}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-xs text-zinc-600 mt-3">
            Pour modifier ces paramètres : fichier <span className="font-mono text-zinc-400">lib/carmelo/config.ts</span>
          </p>
        </Section>

        {/* Actions rapides */}
        <Section title="Actions d'entraînement">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ActionCard
              title="Importer l'historique"
              desc="Chargez vos ventes passées pour que Carmelo apprenne vos critères réels."
              href="/carmelo/import"
              cta="Aller à l'import CSV"
            />
            <ActionCard
              title="Tester une analyse Carmelo"
              desc="Analysez un véhicule réel et vérifiez que la décision correspond à vos attentes."
              href="/carmelo"
              cta="Lancer une analyse"
            />
            <ActionCard
              title="Tester MADORE (mode démo)"
              desc="Simulez des conversations prospects sans créer de leads en base."
              href="/madore?demo=true"
              cta="Ouvrir mode test"
            />
            <ActionCard
              title="Corriger les analyses"
              desc="Utilisez les boutons 👍/👎 sur les fiches véhicules pour affiner la mémoire."
              href="/gp/stock"
              cta="Voir le stock"
            />
          </div>
        </Section>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm font-semibold text-zinc-200">{value}</p>
    </div>
  );
}

function ActionCard({ title, desc, href, cta }: { title: string; desc: string; href: string; cta: string }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-2">
      <p className="text-sm font-semibold text-zinc-100">{title}</p>
      <p className="text-xs text-zinc-500">{desc}</p>
      <Link href={href} className="inline-block text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors">
        {cta} →
      </Link>
    </div>
  );
}
