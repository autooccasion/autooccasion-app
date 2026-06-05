import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import { getVehicles } from 'app/db';
import Link from 'next/link';
import GPNav from '../nav';
import StockActions from './actions';

export const dynamic = 'force-dynamic';

const STATUS_CONFIG: Record<string, { label: string; style: string; order: number }> = {
  prospect:  { label: 'Prospect',  style: 'bg-zinc-800 text-zinc-300 border-zinc-700', order: 1 },
  analyse:   { label: 'Analysé',   style: 'bg-blue-950 text-blue-300 border-blue-800', order: 2 },
  achete:    { label: 'Acheté',    style: 'bg-yellow-950 text-yellow-300 border-yellow-800', order: 3 },
  en_stock:  { label: 'En stock',  style: 'bg-orange-950 text-orange-300 border-orange-800', order: 4 },
  publie:    { label: 'Publié',    style: 'bg-purple-950 text-purple-300 border-purple-800', order: 5 },
  vendu:     { label: 'Vendu',     style: 'bg-green-950 text-green-300 border-green-800', order: 6 },
  refuse:    { label: 'Refusé',    style: 'bg-red-950 text-red-300 border-red-800', order: 7 },
};

const DECISION_DOT: Record<string, string> = {
  VERT: 'bg-green-400', ORANGE: 'bg-orange-400', ROUGE: 'bg-red-400', INCONNU: 'bg-zinc-500',
};

function euro(n: number | null): string {
  return n == null ? '—' : `${n.toLocaleString('fr-BE')} €`;
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
}

export default async function StockPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  let vehicles: Awaited<ReturnType<typeof getVehicles>> = [];
  let loadError = false;
  try {
    vehicles = await getVehicles(session.user.email, 200);
  } catch (err) {
    console.error('Stock page: échec chargement', err);
    loadError = true;
  }

  const activeVehicles = vehicles.filter((v) => v.status !== 'refuse' && v.status !== 'vendu');
  const soldVehicles   = vehicles.filter((v) => v.status === 'vendu');

  const grouped = Object.entries(STATUS_CONFIG)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([status, cfg]) => ({
      status, cfg,
      items: vehicles.filter((v) => v.status === status),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-5xl space-y-6">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">GP-CARS</h1>
          <p className="text-zinc-400 text-sm mt-1">Stock — source de vérité partagée entre agents</p>
        </div>

        <GPNav active="stock" />

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPI label="En stock" value={activeVehicles.length} />
          <KPI label="Vendus" value={soldVehicles.length} />
          <KPI label="Valeur stock" value={euro(activeVehicles.reduce((s,v) => s+(v.realBuyPrice||0), 0))} />
          <KPI label="Marge totale vendue" value={euro(soldVehicles.reduce((s,v) => s+(v.realMargin||0), 0))} />
        </div>

        {loadError && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg p-4 text-sm">
            Impossible de charger le stock. Vérifiez la connexion à la base de données.
          </div>
        )}

        {vehicles.length === 0 && !loadError && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 text-sm text-zinc-400">
            Aucun véhicule en base.{' '}
            <Link href="/carmelo" className="underline text-zinc-200">Analyser un premier véhicule →</Link>
          </div>
        )}

        {grouped.map(({ status, cfg, items }) => (
          <div key={status}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.style}`}>
                {cfg.label}
              </span>
              <span className="text-xs text-zinc-500">{items.length} véhicule{items.length > 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-2">
              {items.map((v) => {
                const decDot = DECISION_DOT[(v.decision || 'INCONNU')] || DECISION_DOT.INCONNU;
                const label = [v.make, v.model, v.year].filter(Boolean).join(' ') || 'Véhicule';
                const needsHuman = v.requiresHumanValidation && v.status === 'analyse';
                return (
                  <details key={v.id} className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
                    <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${decDot}`} />
                        <p className="text-sm text-zinc-100 truncate">{label}</p>
                        {v.km != null && <p className="text-xs text-zinc-500 shrink-0">{v.km.toLocaleString('fr-BE')} km</p>}
                        {needsHuman && (
                          <span className="text-xs bg-yellow-950 border border-yellow-700 text-yellow-300 px-2 py-0.5 rounded-full shrink-0">
                            ⚠️ Validation requise
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 shrink-0 text-xs text-zinc-400">
                        {v.realBuyPrice != null && <span>Acheté {euro(v.realBuyPrice)}</span>}
                        {v.realSellPrice != null && <span>Vendu {euro(v.realSellPrice)}</span>}
                        {v.realMargin != null && (
                          <span className={v.realMargin >= 2500 ? 'text-green-400' : 'text-orange-400'}>
                            {euro(v.realMargin)} marge
                          </span>
                        )}
                        {v.soldInDays != null && <span>{v.soldInDays} j</span>}
                      </div>
                    </summary>

                    <div className="border-t border-zinc-800 p-4 space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <Field label="Prix demandé" value={euro(v.askingPrice)} />
                        <Field label="Achat max conseillé" value={euro(v.maxBuyPrice)} />
                        <Field label="Marge estimée" value={euro(v.estimatedMargin)} />
                        <Field label="Confiance" value={v.confidence != null ? `${v.confidence} %` : '—'} />
                        <Field label="Rotation" value={v.rotationScore != null ? `${v.rotationScore}/10` : '—'} />
                        <Field label="Analyse" value={formatDate(v.createdAt)} />
                        <Field label="Acheté le" value={formatDate(v.boughtAt)} />
                        <Field label="Vendu le" value={formatDate(v.soldAt)} />
                      </div>

                      {v.listingUrl && (
                        <a href={v.listingUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-zinc-300 underline">Annonce source ↗</a>
                      )}

                      {v.listingTitle && (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Annonce GP-CARS</p>
                          <p className="text-sm font-semibold text-zinc-100">{v.listingTitle}</p>
                          <p className="text-xs text-zinc-400 mt-1 line-clamp-3">{v.listingDescription}</p>
                        </div>
                      )}

                      {v.controllerFlags && Array.isArray(v.controllerFlags) && v.controllerFlags.length > 0 && (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Contrôleur</p>
                          {(v.controllerFlags as any[]).map((f, i) => (
                            <p key={i} className={`text-xs ${f.severity === 'bloquant' ? 'text-red-400' : f.severity === 'avertissement' ? 'text-yellow-400' : 'text-zinc-400'}`}>
                              {f.severity === 'bloquant' ? '🔴' : f.severity === 'avertissement' ? '🟡' : 'ℹ️'} {f.message}
                            </p>
                          ))}
                        </div>
                      )}

                      <StockActions vehicle={{
                        id: v.id,
                        status: v.status as string,
                        listingTitle: v.listingTitle,
                        confidence: v.confidence,
                        make: v.make ?? null,
                        model: v.model ?? null,
                        year: v.year ?? null,
                        km: v.km ?? null,
                        askingPrice: v.askingPrice ?? null,
                        maxBuyPrice: v.maxBuyPrice ?? null,
                        listingUrl: v.listingUrl ?? null,
                      }} />
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        ))}
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className="text-zinc-200">{value}</p>
    </div>
  );
}
