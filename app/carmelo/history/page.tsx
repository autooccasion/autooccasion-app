import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import { getAnalyses } from 'app/db';
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
          <p className="text-zinc-400 text-sm mt-1">Historique des analyses</p>
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
            const titre = (a.vehicule || '').split('\n')[0].slice(0, 120) || 'Véhicule';

            return (
              <details
                key={a.id}
                className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden group"
              >
                <summary className="flex items-center justify-between gap-3 p-4 cursor-pointer list-none">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-100 truncate">{titre}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{formatDate(a.createdAt)}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${style}`}>
                    {label}
                  </span>
                </summary>
                <div className="border-t border-zinc-800 p-4 space-y-3">
                  {a.vehicule && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Demande</p>
                      <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono">{a.vehicule}</pre>
                    </div>
                  )}
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Analyse</p>
                    <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-mono leading-relaxed">
                      {a.analyse}
                    </pre>
                  </div>
                </div>
              </details>
            );
          })}
        </div>

      </div>
    </div>
  );
}
