import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import { getVehicleSummaries } from 'app/db';
import { computeMakeStats, computeStockHealth, computePerformanceKPIs, computeProofMetrics } from '@/lib/agents/analytics';
import Link from 'next/link';
import GPNav from '../nav';

export const dynamic = 'force-dynamic';

function euro(n: number | null | undefined): string {
  return n == null ? '—' : `${n.toLocaleString('fr-BE')} €`;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  let summaries: Awaited<ReturnType<typeof getVehicleSummaries>> = [];
  try { summaries = await getVehicleSummaries(session.user.email); }
  catch (err) { console.error('Dashboard: erreur analytics', err); }

  const makeStats  = computeMakeStats(summaries);
  const health     = computeStockHealth(summaries);
  const kpis       = computePerformanceKPIs(summaries);
  const proof      = computeProofMetrics(summaries);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-5xl space-y-8">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">GP-CARS</h1>
          <p className="text-zinc-400 text-sm mt-1">Dashboard — performance & apprentissage</p>
        </div>

        <GPNav active="dashboard" />

        {/* KPIs ligne */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPI label="Vendus ce mois" value={kpis.soldLast30} />
          <KPI label="Vendus cette semaine" value={kpis.soldLast7} />
          <KPI label="Marge moyenne (30 j)" value={euro(kpis.avgMarginLast30)} />
          <KPI label="Rotation moyenne (30 j)" value={kpis.avgRotationLast30 != null ? `${kpis.avgRotationLast30} j` : '—'} />
        </div>

        {/* Preuve — Carmelo vs Réalité */}
        <Section title="Carmelo vs Réalité — preuve de valeur">
          {summaries.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 text-sm text-zinc-400">
              Carmelo n&apos;a pas encore assez de données pour prouver sa valeur. Analysez et vendez des véhicules :
              le tableau comparera ensuite ses estimations à vos résultats réels.
            </div>
          ) : (
            <>
              {!proof.hasEnoughData && (
                <div className="bg-blue-950 border border-blue-900 rounded-lg p-3 text-xs text-blue-300 mb-3">
                  ℹ️ Échantillon encore faible ({proof.soldWithEstimate} vente{proof.soldWithEstimate > 1 ? 's' : ''} avec estimation).
                  Les chiffres ci-dessous se fiabiliseront à partir de 5 ventes.
                </div>
              )}

              {/* Bandeau valeur générée */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <ProofCard
                  label="Marge réelle générée"
                  value={euro(proof.totalRealMargin)}
                  sub="Sur les véhicules vendus"
                  tone="green"
                />
                <ProofCard
                  label="Pertes évitées (refus ROUGE)"
                  value={proof.refusedCount === 0 ? '—' : `${proof.refusedCount} refus`}
                  sub={proof.estimatedLossAvoided != null
                    ? `≈ ${euro(proof.estimatedLossAvoided)} de marge négative écartée`
                    : 'Mauvais achats écartés'}
                  tone="red"
                />
                <ProofCard
                  label="Discipline d'achat"
                  value={proof.buyDisciplinePct != null ? `${proof.buyDisciplinePct} %` : '—'}
                  sub={proof.buyDisciplineCount > 0
                    ? `${proof.buyDisciplineRespected}/${proof.buyDisciplineCount} achats sous le plafond Carmelo`
                    : 'Aucun achat chiffré'}
                  tone={proof.buyDisciplinePct != null && proof.buyDisciplinePct >= 80 ? 'green' : 'orange'}
                />
              </div>

              {/* Tableau précision */}
              <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 space-y-3">
                <p className="text-xs text-zinc-500 uppercase tracking-wide">Précision des estimations</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
                        <th className="py-2 pr-4">Indicateur</th>
                        <th className="py-2 pr-4">Carmelo (estimé)</th>
                        <th className="py-2 pr-4">Réel</th>
                        <th className="py-2">Écart</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-zinc-900">
                        <td className="py-2 pr-4 text-zinc-300">Marge moyenne / véhicule</td>
                        <td className="py-2 pr-4 text-zinc-100 font-semibold">{euro(proof.avgEstimatedMargin)}</td>
                        <td className="py-2 pr-4 text-zinc-100 font-semibold">{euro(proof.avgRealMargin)}</td>
                        <td className="py-2">
                          {proof.marginMae != null
                            ? <span className={proof.marginMae <= proof.marginTolerance ? 'text-green-400' : 'text-orange-400'}>± {euro(proof.marginMae)}</span>
                            : <span className="text-zinc-600">—</span>}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-zinc-300">Estimations justes (± {proof.marginTolerance} €)</td>
                        <td className="py-2 pr-4 text-zinc-500" colSpan={2}>
                          {proof.soldWithEstimate} vente{proof.soldWithEstimate > 1 ? 's' : ''} évaluée{proof.soldWithEstimate > 1 ? 's' : ''}
                        </td>
                        <td className="py-2">
                          {proof.marginHitRate != null
                            ? <span className={proof.marginHitRate >= 70 ? 'text-green-400' : proof.marginHitRate >= 40 ? 'text-yellow-400' : 'text-red-400'}>{proof.marginHitRate} %</span>
                            : <span className="text-zinc-600">—</span>}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {proof.greenBought > 0 && (
                  <p className="text-xs text-zinc-400 pt-1 border-t border-zinc-800">
                    Décisions OR/VERT : <span className="text-green-400 font-semibold">{proof.greenSold}/{proof.greenBought} vendus</span>
                    {proof.greenWinRatePct != null && <span className="text-zinc-500"> ({proof.greenWinRatePct} % de réussite)</span>}
                  </p>
                )}
              </div>
            </>
          )}
        </Section>

        {/* Stock health */}
        <Section title="État du stock">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPI label="Véhicules en stock" value={health.inStock} />
            <KPI label="Annonces publiées" value={health.published} />
            <KPI label="Valeur stock achat" value={euro(health.totalStockValue)} />
            <KPI label="Rotation moy. (vendus)" value={health.avgDaysInStock != null ? `${health.avgDaysInStock} j` : '—'} />
          </div>

          {health.slowVehicles.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-yellow-400 mb-2">
                ⚠️ {health.slowVehicles.length} véhicule{health.slowVehicles.length > 1 ? 's' : ''} publié{health.slowVehicles.length > 1 ? 's' : ''} depuis plus de 60 jours
              </p>
              {health.slowVehicles.map((v) => (
                <p key={v.id} className="text-xs text-zinc-400">
                  · {v.make} {v.model} {v.year} — publié à {euro(v.askingPrice)}
                </p>
              ))}
            </div>
          )}
        </Section>

        {/* Achats recommandés */}
        <Section title="Achats recommandés">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 space-y-2 text-sm">
            <p>
              <span className="text-zinc-400">Objectif stock :</span>{' '}
              <span className="text-zinc-100 font-semibold">10 véhicules</span>
            </p>
            <p>
              <span className="text-zinc-400">Stock actuel :</span>{' '}
              <span className="text-zinc-100 font-semibold">{health.inStock}</span>
            </p>
            <p>
              <span className="text-zinc-400">À racheter cette semaine :</span>{' '}
              <span className={`font-bold ${kpis.weeklyBuyTarget > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                {kpis.weeklyBuyTarget} véhicule{kpis.weeklyBuyTarget > 1 ? 's' : ''}
              </span>
            </p>
            {kpis.bestMake && (
              <p>
                <span className="text-zinc-400">Marque la plus rentable :</span>{' '}
                <span className="text-green-400 font-semibold">{kpis.bestMake}</span>
              </p>
            )}
            {kpis.worstMake && kpis.worstMake !== kpis.bestMake && (
              <p>
                <span className="text-zinc-400">Marque la moins rentable :</span>{' '}
                <span className="text-red-400 font-semibold">{kpis.worstMake}</span>
              </p>
            )}
          </div>
        </Section>

        {/* Par marque */}
        {makeStats.length > 0 && (
          <Section title="Performance par marque">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
                    <th className="py-2 pr-4">Marque</th>
                    <th className="py-2 pr-4">Achetés</th>
                    <th className="py-2 pr-4">Vendus</th>
                    <th className="py-2 pr-4">Conv.</th>
                    <th className="py-2 pr-4">Marge moy.</th>
                    <th className="py-2">Rotation moy.</th>
                  </tr>
                </thead>
                <tbody>
                  {makeStats.map((m) => (
                    <tr key={m.make} className="border-b border-zinc-900 hover:bg-zinc-900 transition-colors">
                      <td className="py-2 pr-4 font-semibold text-zinc-100">{m.make}</td>
                      <td className="py-2 pr-4 text-zinc-300">{m.count}</td>
                      <td className="py-2 pr-4 text-zinc-300">{m.sold}</td>
                      <td className="py-2 pr-4">
                        <span className={m.conversionRate >= 70 ? 'text-green-400' : m.conversionRate >= 40 ? 'text-yellow-400' : 'text-red-400'}>
                          {m.conversionRate} %
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className={m.avgMargin != null && m.avgMargin >= 3000 ? 'text-green-400' : 'text-orange-400'}>
                          {euro(m.avgMargin)}
                        </span>
                      </td>
                      <td className="py-2 text-zinc-300">
                        {m.avgDays != null ? `${m.avgDays} j` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {summaries.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 text-sm text-zinc-400 text-center">
            Aucune donnée disponible.{' '}
            <Link href="/carmelo" className="underline text-zinc-200">Commencer par analyser un véhicule →</Link>
          </div>
        )}

      </div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-lg font-bold text-zinc-100 mt-0.5">{value}</p>
    </div>
  );
}

function ProofCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'green' | 'red' | 'orange' }) {
  const toneStyles = {
    green:  'border-green-900 bg-green-950/40',
    red:    'border-red-900 bg-red-950/40',
    orange: 'border-orange-900 bg-orange-950/40',
  };
  const valueColor = { green: 'text-green-400', red: 'text-red-300', orange: 'text-orange-300' };
  return (
    <div className={`border rounded-lg p-4 ${toneStyles[tone]}`}>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${valueColor[tone]}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{sub}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}
