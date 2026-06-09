import { auth } from 'app/auth';
import { redirect, notFound } from 'next/navigation';
import { getVehicle, getVehicleEvents } from 'app/db';
import Link from 'next/link';
import type { ReactNode } from 'react';
import GPNav from '../../nav';
import FeedbackPanel from './feedback';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect', analyse: 'Analysé', achete: 'Acheté',
  en_stock: 'En stock', publie: 'Publié', vendu: 'Vendu', refuse: 'Refusé',
};

const DECISION_STYLE: Record<string, string> = {
  VERT:    'text-green-400  bg-green-950  border-green-800',
  ORANGE:  'text-orange-400 bg-orange-950 border-orange-800',
  ROUGE:   'text-red-400    bg-red-950    border-red-800',
  INCONNU: 'text-zinc-400   bg-zinc-800   border-zinc-700',
};

function euro(n: number | null | undefined): string {
  return n == null ? '—' : `${n.toLocaleString('fr-BE')} €`;
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
}

function Field({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm text-zinc-200">{value}</p>
    </div>
  );
}

export default async function VehicleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [v, events] = await Promise.all([
    getVehicle(id, session.user.email),
    getVehicleEvents(id, session.user.email),
  ]);

  if (!v) notFound();

  const label = [v.make, v.model, v.year].filter(Boolean).join(' ') || 'Véhicule';
  const decStyle = DECISION_STYLE[(v.decision ?? 'INCONNU')] ?? DECISION_STYLE.INCONNU;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-4xl space-y-6">

        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/gp/stock" className="text-xs text-zinc-500 hover:text-zinc-300 mb-2 inline-block">
              ← Retour au stock
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">{label}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-zinc-400">{STATUS_LABELS[v.status ?? 'analyse'] ?? v.status}</span>
              {v.decision && (
                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${decStyle}`}>
                  {v.decision}
                </span>
              )}
              {v.requiresHumanValidation && (
                <span className="text-xs bg-yellow-950 border border-yellow-700 text-yellow-300 px-2 py-0.5 rounded-full">
                  ⚠️ Validation requise
                </span>
              )}
            </div>
          </div>
          {v.listingUrl && (
            <a
              href={v.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              Annonce source ↗
            </a>
          )}
        </div>

        <GPNav active="stock" />

        {/* Identification */}
        <Section title="Identification">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Marque" value={v.make ?? '—'} />
            <Field label="Modèle" value={v.model ?? '—'} />
            <Field label="Année" value={v.year?.toString() ?? '—'} />
            <Field label="Kilométrage" value={v.km != null ? `${v.km.toLocaleString('fr-BE')} km` : '—'} />
            <Field label="Carburant" value={v.fuel ?? '—'} />
            <Field label="Boîte" value={v.gearbox ?? '—'} />
            <Field label="Couleur" value={v.color ?? '—'} />
            <Field label="Puissance" value={v.power ?? '—'} />
            {v.vin && <Field label="VIN" value={<span className="font-mono text-xs">{v.vin}</span>} />}
          </div>
        </Section>

        {/* Analyse Carmelo */}
        <Section title="Analyse Carmelo">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Décision" value={v.decision ?? '—'} />
            <Field label="Confiance" value={v.confidence != null ? `${v.confidence} %` : '—'} />
            <Field label="Prix demandé" value={euro(v.askingPrice)} />
            <Field label="Prix marché" value={euro(v.marketPrice)} />
            <Field label="Achat max conseillé" value={euro(v.maxBuyPrice)} />
            <Field label="Marge estimée" value={euro(v.estimatedMargin)} />
            <Field label="Score rotation" value={v.rotationScore != null ? `${v.rotationScore}/10` : '—'} />
            <Field label="Analysé le" value={formatDate(v.createdAt)} />
          </div>

          <FeedbackPanel vehicleId={v.id} current={(v as any).analysisFeedback ?? null} />

          {v.analysisReport && (
            <details className="mt-3">
              <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-200 select-none">
                Voir le rapport complet
              </summary>
              <pre className="mt-2 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                {v.analysisReport}
              </pre>
            </details>
          )}
        </Section>

        {/* Contrôleur */}
        {(v.controllerFlags && Array.isArray(v.controllerFlags) && v.controllerFlags.length > 0) && (
          <Section title="Contrôleur">
            <div className="space-y-1">
              {(v.controllerFlags as { severity: string; message: string }[]).map((f, i) => (
                <p key={i} className={`text-sm ${
                  f.severity === 'bloquant' ? 'text-red-400' :
                  f.severity === 'avertissement' ? 'text-yellow-400' : 'text-zinc-400'
                }`}>
                  {f.severity === 'bloquant' ? '🔴' : f.severity === 'avertissement' ? '🟡' : 'ℹ️'} {f.message}
                </p>
              ))}
              {v.controllerNotes && (
                <p className="text-xs text-zinc-500 mt-2">{v.controllerNotes}</p>
              )}
            </div>
          </Section>
        )}

        {/* Achat & vente */}
        <Section title="Achat & vente">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Prix d'achat réel" value={euro(v.realBuyPrice)} />
            <Field label="Acheté le" value={formatDate(v.boughtAt)} />
            <Field label="Prix de vente réel" value={euro(v.realSellPrice)} />
            <Field label="Vendu le" value={formatDate(v.soldAt)} />
            <Field label="Jours en stock" value={v.soldInDays != null ? `${v.soldInDays} j` : '—'} />
            <Field label="Marge réelle" value={
              v.realMargin != null
                ? <span className={v.realMargin >= 2500 ? 'text-green-400' : 'text-orange-400'}>
                    {euro(v.realMargin)}
                  </span>
                : '—'
            } />
          </div>
        </Section>

        {/* Annonce marketing */}
        {v.listingTitle && (
          <Section title="Annonce marketing">
            <p className="font-semibold text-zinc-100">{v.listingTitle}</p>
            {v.listingDescription && (
              <p className="text-sm text-zinc-400 mt-2 whitespace-pre-wrap">{v.listingDescription}</p>
            )}
            {Array.isArray(v.listingPoints) && v.listingPoints.length > 0 && (
              <ul className="mt-2 space-y-1">
                {(v.listingPoints as string[]).map((pt, i) => (
                  <li key={i} className="text-xs text-zinc-300 before:content-['·'] before:mr-1">{pt}</li>
                ))}
              </ul>
            )}
            {Array.isArray(v.listingTags) && v.listingTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {(v.listingTags as string[]).map((tag, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-400">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {v.publishedAt && (
              <p className="text-xs text-zinc-500 mt-2">Publié le {formatDate(v.publishedAt)}</p>
            )}
          </Section>
        )}

        {/* Historique des événements */}
        {events.length > 0 && (
          <Section title="Historique">
            <ol className="relative border-l border-zinc-800 ml-2 space-y-4">
              {events.map((e) => (
                <li key={e.id} className="ml-4">
                  <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-zinc-700 border border-zinc-600" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-zinc-500">{formatDate(e.createdAt)}</span>
                    <span className="text-xs text-zinc-300">
                      {e.fromStatus ? `${STATUS_LABELS[e.fromStatus] ?? e.fromStatus} →` : ''}
                      {' '}
                      <strong>{STATUS_LABELS[e.toStatus ?? ''] ?? e.toStatus}</strong>
                    </span>
                    {e.agentName && (
                      <span className="text-xs text-zinc-500 italic">via {e.agentName}</span>
                    )}
                    {e.actorType === 'agent' && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-950 border border-blue-800 text-blue-300 rounded">
                        agent
                      </span>
                    )}
                  </div>
                  {e.note && <p className="text-xs text-zinc-500 mt-0.5">{e.note}</p>}
                </li>
              ))}
            </ol>
          </Section>
        )}

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-3">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}
