import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import { getAnalyses } from 'app/db';
import { updateVehicleOutcome } from 'app/actions';
import CarmeloNav from '../nav';

export const dynamic = 'force-dynamic';

const DECISION_STYLES: Record<string, string> = {
  VERT: 'bg-green-950 text-green-300 border-green-800',
  ORANGE: 'bg-orange-950 text-orange-300 border-orange-800',
  ROUGE: 'bg-red-950 text-red-300 border-red-800',
  INCONNU: 'bg-zinc-800 text-zinc-300 border-zinc-700',
};

const DECISION_LABELS: Record<string, string> = {
  VERT: '🟢 VERT',
  ORANGE: '🟠 ORANGE',
  ROUGE: '🔴 ROUGE',
  INCONNU: '⚪ —',
};

const STATUS_LABELS: Record<string, string> = {
  analyse: 'Analysé',
  achete: 'Acheté',
  vendu: 'Vendu',
  refuse: 'Refusé',
};

function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function euro(n: number | null): string {
  return n == null ? '—' : `${n.toLocaleString('fr-BE')} €`;
}

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  let analyses: Awaited<ReturnType<typeof getAnalyses>> = [];
  let loadError = false;
  try {
    analyses = await getAnalyses(session.user.email);
  } catch (err) {
    console.error('Carmelo history: échec chargement', err);
    loadError = true;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl space-y-6">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carmelo — GP-CARS</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Historique &amp; mémoire d&apos;apprentissage
          </p>
        </div>

        <CarmeloNav active="historique" />

        {loadError && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg p-4 text-sm">
            Impossible de charger l&apos;historique. Vérifiez la connexion à la base de données.
          </div>
        )}

        {!loadError && analyses.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 text-sm text-zinc-400">
            Aucune analyse enregistrée pour le moment.{' '}
            <a href="/carmelo" className="underline text-zinc-200">
              Analyser un véhicule →
            </a>
          </div>
        )}

        <div className="space-y-3">
          {analyses.map((a) => {
            const decision = a.decision || 'INCONNU';
            const style = DECISION_STYLES[decision] || DECISION_STYLES.INCONNU;
            const label = DECISION_LABELS[decision] || DECISION_LABELS.INCONNU;
            const titre =
              a.vehiculeResume ||
              (a.vehicule || '').split('\n')[0].slice(0, 120) ||
              'Véhicule';
            const status = a.status || 'analyse';

            return (
              <details
                key={a.id}
                className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden group"
              >
                <summary className="flex items-center justify-between gap-3 p-4 cursor-pointer list-none">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-100 truncate">{titre}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {formatDate(a.createdAt)} · {STATUS_LABELS[status] || status}
                      {a.recommendedMaxBuy != null && ` · achat max ${euro(a.recommendedMaxBuy)}`}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${style}`}>
                    {label}
                  </span>
                </summary>

                <div className="border-t border-zinc-800 p-4 space-y-4">
                  {/* Structured memory */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <Field label="Prix marché" value={euro(a.marketPrice)} />
                    <Field label="Achat max conseillé" value={euro(a.recommendedMaxBuy)} />
                    <Field label="Marge estimée" value={euro(a.estimatedMargin)} />
                    <Field label="Rotation" value={a.rotationScore != null ? `${a.rotationScore}/10` : '—'} />
                    <Field label="Confiance" value={a.confidence != null ? `${a.confidence} %` : '—'} />
                    {a.realBuyPrice != null && <Field label="Acheté à" value={euro(a.realBuyPrice)} />}
                    {a.realSellPrice != null && <Field label="Vendu à" value={euro(a.realSellPrice)} />}
                    {a.soldInDays != null && <Field label="Jours en stock" value={`${a.soldInDays} j`} />}
                  </div>

                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-zinc-300 underline"
                    >
                      Voir l&apos;annonce ↗
                    </a>
                  )}

                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Analyse</p>
                    <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-mono leading-relaxed">
                      {a.analyse}
                    </pre>
                  </div>

                  {/* Outcome form — feeds Carmelo's learning memory */}
                  <form
                    action={updateVehicleOutcome}
                    className="border-t border-zinc-800 pt-4 space-y-3"
                  >
                    <input type="hidden" name="id" value={a.id} />
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Résultat réel (apprentissage)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <label className="text-xs text-zinc-400 space-y-1">
                        <span>Statut</span>
                        <select
                          name="status"
                          defaultValue={status}
                          className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100"
                        >
                          <option value="analyse">Analysé</option>
                          <option value="achete">Acheté</option>
                          <option value="vendu">Vendu</option>
                          <option value="refuse">Refusé</option>
                        </select>
                      </label>
                      <NumberField name="realBuyPrice" label="Prix d'achat réel" value={a.realBuyPrice} />
                      <NumberField name="realSellPrice" label="Prix de vente réel" value={a.realSellPrice} />
                      <DateField name="boughtAt" label="Date d'achat" value={a.boughtAt} />
                      <DateField name="soldAt" label="Date de vente" value={a.soldAt} />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-white text-black text-xs font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
                    >
                      Enregistrer le résultat
                    </button>
                  </form>
                </div>
              </details>
            );
          })}
        </div>

      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className="text-zinc-200">{value}</p>
    </div>
  );
}

function NumberField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: number | null;
}) {
  return (
    <label className="text-xs text-zinc-400 space-y-1">
      <span>{label}</span>
      <input
        type="number"
        name={name}
        defaultValue={value ?? ''}
        placeholder="€"
        className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100"
      />
    </label>
  );
}

function DateField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: Date | null;
}) {
  const iso = value ? new Date(value).toISOString().slice(0, 10) : '';
  return (
    <label className="text-xs text-zinc-400 space-y-1">
      <span>{label}</span>
      <input
        type="date"
        name={name}
        defaultValue={iso}
        className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100"
      />
    </label>
  );
}
