import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import { getOpportunities } from 'app/db';
import { setOpportunityStatus } from 'app/actions';
import { buildDigest } from '@/lib/carmelo/digest';
import CarmeloNav from '../nav';

export const dynamic = 'force-dynamic';

const ZONE_STYLE: Record<string, string> = {
  vert: 'bg-green-950 text-green-300 border-green-800',
  orange: 'bg-orange-950 text-orange-300 border-orange-800',
  rouge: 'bg-red-950 text-red-300 border-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  ecarte: 'Écarté',
};

function euro(n: number | null): string {
  return n == null ? '—' : `${n.toLocaleString('fr-BE')} €`;
}

export default async function OpportunitesPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  let opportunities: Awaited<ReturnType<typeof getOpportunities>> = [];
  let loadError = false;
  try {
    opportunities = await getOpportunities(session.user.email);
  } catch (err) {
    console.error('Carmelo opportunités: échec chargement', err);
    loadError = true;
  }

  const actives = opportunities.filter((o) => (o.status || 'nouveau') !== 'ecarte');
  const digest = buildDigest(
    actives.map((o) => ({
      vehicule: o.vehicule,
      url: o.url,
      askingPrice: o.askingPrice,
      targetSell: o.targetSell,
      maxBuy: o.maxBuy,
      zone: o.zone,
    })),
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl space-y-6">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carmelo — GP-CARS</h1>
          <p className="text-zinc-400 text-sm mt-1">Opportunités du jour</p>
        </div>

        <CarmeloNav active="opportunites" />

        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5">
          <p className="text-sm font-semibold text-zinc-100">{digest.title}</p>
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-sans mt-2 leading-relaxed">
            {digest.text}
          </pre>
        </div>

        {loadError && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg p-4 text-sm">
            Impossible de charger les opportunités.
          </div>
        )}

        {!loadError && opportunities.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 text-sm text-zinc-400">
            Aucune opportunité enregistrée.{' '}
            <a href="/carmelo/marche" className="underline text-zinc-200">
              Étudier le marché →
            </a>
          </div>
        )}

        <div className="space-y-3">
          {opportunities.map((o) => {
            const zone = o.zone || 'vert';
            const status = o.status || 'nouveau';
            return (
              <div
                key={o.id}
                className={`bg-zinc-900 border rounded-lg p-4 space-y-3 ${
                  status === 'ecarte' ? 'border-zinc-800 opacity-60' : 'border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-100">{o.vehicule || 'Véhicule'}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{STATUS_LABELS[status] || status}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${ZONE_STYLE[zone] || ZONE_STYLE.vert}`}>
                    {zone}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-zinc-500">Prix demandé</p>
                    <p className="text-zinc-200">{euro(o.askingPrice)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Achat max</p>
                    <p className="text-white font-bold">{euro(o.maxBuy)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Revente cible</p>
                    <p className="text-zinc-200">{euro(o.targetSell)}</p>
                  </div>
                </div>

                {o.url && (
                  <a
                    href={o.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-zinc-300 underline"
                  >
                    Voir l&apos;annonce ↗
                  </a>
                )}

                {o.contactMessage && (
                  <details className="bg-zinc-950 border border-zinc-800 rounded p-3">
                    <summary className="text-xs text-zinc-400 cursor-pointer">
                      Message de prise de contact (à valider)
                    </summary>
                    <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-sans mt-2 leading-relaxed">
                      {o.contactMessage}
                    </pre>
                  </details>
                )}

                <div className="flex gap-2 pt-1">
                  <StatusButton id={o.id} status="contacte" label="Marquer contacté" />
                  <StatusButton id={o.id} status="ecarte" label="Écarter" />
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

function StatusButton({
  id,
  status,
  label,
}: {
  id: number;
  status: string;
  label: string;
}) {
  return (
    <form action={setOpportunityStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className="px-3 py-1.5 bg-zinc-800 text-zinc-200 text-xs rounded hover:bg-zinc-700 transition-colors"
      >
        {label}
      </button>
    </form>
  );
}
