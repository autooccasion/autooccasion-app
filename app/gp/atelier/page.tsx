import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import {
  getAtelierInterventions, getUpcomingRdvs, getPiecesToOrder,
  getAtelierStats, getVehicles,
} from 'app/db';
import type { AtelierInterventionRecord, RdvAtelierRecord, PieceCommandeRecord, VehicleRecord } from 'app/db';
import GPNav from '../nav';

export const dynamic = 'force-dynamic';

// ─── helpers ────────────────────────────────────────────────────────────────

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    planifie: 'Planifié', en_cours: 'En cours', termine: 'Terminé', facture: 'Facturé',
  };
  return labels[status] ?? status;
}

function statusColor(status: string): string {
  const colors: Record<string, string> = {
    planifie:  'bg-zinc-800 text-zinc-300 border-zinc-700',
    en_cours:  'bg-blue-950 text-blue-300 border-blue-800',
    termine:   'bg-green-950 text-green-300 border-green-800',
    facture:   'bg-purple-950 text-purple-300 border-purple-800',
  };
  return colors[status] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700';
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    revision: 'Révision', reparation: 'Réparation',
    preparation_vente: 'Prép. vente', diagnostic: 'Diagnostic', autre: 'Autre',
  };
  return labels[type] ?? type;
}

function typeIcon(type: string): string {
  const icons: Record<string, string> = {
    revision: '🔧', reparation: '🛠️', preparation_vente: '✨', diagnostic: '🔍', autre: '📋',
  };
  return icons[type] ?? '📋';
}

function rdvTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    diagnostic: 'Diagnostic', intervention: 'Intervention',
    livraison: 'Livraison', reprise_trade_in: 'Reprise', essai: 'Essai',
  };
  return labels[type] ?? type;
}

function rdvStatusColor(status: string): string {
  const colors: Record<string, string> = {
    planifie: 'text-zinc-400', confirme: 'text-green-400', annule: 'text-red-400', termine: 'text-zinc-600',
  };
  return colors[status] ?? 'text-zinc-400';
}

function pieceStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    a_commander: 'À commander', commande: 'Commandée', recu: 'Reçue', monte: 'Montée',
  };
  return labels[status] ?? status;
}

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' });
}

function formatDateTime(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-BE', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function vehicleLabel(v: VehicleRecord | undefined): string {
  if (!v) return 'Véhicule inconnu';
  return `${v.make ?? ''} ${v.model ?? ''} ${v.year ? `(${v.year})` : ''}`.trim();
}

// ─── sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string; value: number | string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className={`text-2xl font-bold ${color ?? 'text-zinc-100'}`}>{value}</div>
      <div className="text-sm text-zinc-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-zinc-600 mt-1">{sub}</div>}
    </div>
  );
}

function InterventionCard({
  intervention, vehicle,
}: {
  intervention: AtelierInterventionRecord;
  vehicle: VehicleRecord | undefined;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-base mr-1">{typeIcon(intervention.type ?? '')}</span>
          <span className="font-medium text-zinc-200">{vehicleLabel(vehicle)}</span>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded border ${statusColor(intervention.status ?? '')}`}>
          {statusLabel(intervention.status ?? '')}
        </span>
      </div>

      <div className="text-zinc-500 text-xs">{typeLabel(intervention.type ?? '')}</div>

      {intervention.description && (
        <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2">{intervention.description}</p>
      )}

      {intervention.estimatedCost != null && (
        <div className="text-zinc-400 text-xs">
          Estimé : <span className="text-zinc-200">{intervention.estimatedCost.toLocaleString('fr-BE')} €</span>
          {intervention.realCost != null && (
            <> → Réel : <span className="text-zinc-200">{intervention.realCost.toLocaleString('fr-BE')} €</span></>
          )}
        </div>
      )}

      {intervention.mecanicNotes && (
        <p className="text-zinc-500 text-xs italic line-clamp-2 border-t border-zinc-800 pt-1.5">
          {intervention.mecanicNotes}
        </p>
      )}

      <div className="text-zinc-700 text-xs pt-1">
        Créé le {formatDate(intervention.createdAt)}
        {intervention.startDate && ` · Démarré ${formatDate(intervention.startDate)}`}
        {intervention.endDate && ` · Terminé ${formatDate(intervention.endDate)}`}
      </div>
    </div>
  );
}

// ─── page ───────────────────────────────────────────────────────────────────

export default async function AtelierPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const email = session.user.email;

  const [interventions, rdvs, piecesToOrder, stats, vehicles] = await Promise.all([
    getAtelierInterventions(email),
    getUpcomingRdvs(email, 14),
    getPiecesToOrder(email),
    getAtelierStats(email),
    getVehicles(email),
  ]);

  const vehicleMap = new Map<number, VehicleRecord>(vehicles.map(v => [v.id, v]));

  const kanban: Record<string, AtelierInterventionRecord[]> = {
    planifie:  interventions.filter(i => i.status === 'planifie'),
    en_cours:  interventions.filter(i => i.status === 'en_cours'),
    termine:   interventions.filter(i => i.status === 'termine'),
    facture:   interventions.filter(i => i.status === 'facture'),
  };

  const totalAtelier = interventions
    .filter(i => i.realCost != null)
    .reduce((acc, i) => acc + (i.realCost ?? 0), 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      <GPNav active="atelier" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Atelier — Agent Mécanique & RDV</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Interventions, commandes de pièces et planification des rendez-vous
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-green-950 border border-green-800 text-green-400 px-2 py-0.5 rounded-full font-semibold">
            ● v1.0
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="En cours" value={stats.enCours} color="text-blue-300" />
        <StatCard label="Planifiées" value={stats.planifie} color="text-zinc-200" />
        <StatCard label="Terminées" value={stats.termine} color="text-green-300" />
        <StatCard label="Facturées" value={stats.facture} color="text-purple-300" />
        <StatCard label="Pièces à commander" value={stats.piecesACommander} color="text-orange-300" />
        <StatCard
          label="RDV cette semaine"
          value={stats.rdvsThisWeek}
          color="text-zinc-200"
          sub={totalAtelier > 0 ? `${totalAtelier.toLocaleString('fr-BE')} € cumulé` : undefined}
        />
      </div>

      {/* Kanban */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Interventions
        </h2>
        {interventions.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center text-zinc-500">
            <p className="text-lg mb-1">Aucune intervention</p>
            <p className="text-sm">
              Les interventions sont créées automatiquement quand vous marquez un véhicule comme &quot;Acheté&quot;
              dans le Stock.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['planifie', 'en_cours', 'termine', 'facture'] as const).map(col => (
              <div key={col} className="space-y-2">
                <div className={`text-xs font-semibold uppercase tracking-wider px-1 ${
                  col === 'en_cours' ? 'text-blue-400' :
                  col === 'termine'  ? 'text-green-400' :
                  col === 'facture'  ? 'text-purple-400' :
                  'text-zinc-400'
                }`}>
                  {statusLabel(col)} ({kanban[col].length})
                </div>
                {kanban[col].length === 0 ? (
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-center text-zinc-700 text-xs">
                    Aucune
                  </div>
                ) : (
                  kanban[col].map(intervention => (
                    <InterventionCard
                      key={intervention.id}
                      intervention={intervention}
                      vehicle={vehicleMap.get(intervention.vehicleId)}
                    />
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* RDV Section */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Rendez-vous — 14 prochains jours
        </h2>
        {rdvs.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center text-zinc-600 text-sm">
            Aucun RDV planifié
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-2 text-left">Date & heure</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Client</th>
                  <th className="px-4 py-2 text-left">Véhicule</th>
                  <th className="px-4 py-2 text-left">Durée</th>
                  <th className="px-4 py-2 text-left">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rdvs.map((rdv, idx) => (
                  <tr key={rdv.id} className={idx % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-950'}>
                    <td className="px-4 py-2.5 text-zinc-200 font-medium whitespace-nowrap">
                      {formatDateTime(rdv.scheduledAt)}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-300">{rdvTypeLabel(rdv.type)}</td>
                    <td className="px-4 py-2.5 text-zinc-400">
                      {rdv.customerName ?? '—'}
                      {rdv.customerPhone && (
                        <span className="text-zinc-600 ml-1 text-xs">{rdv.customerPhone}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400">
                      {rdv.vehicleId ? vehicleLabel(vehicleMap.get(rdv.vehicleId)) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500 text-xs">
                      {rdv.durationMinutes} min
                    </td>
                    <td className={`px-4 py-2.5 text-xs font-medium ${rdvStatusColor(rdv.status ?? '')}`}>
                      {rdv.status ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pieces to order */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Pièces à commander ({piecesToOrder.length})
        </h2>
        {piecesToOrder.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center text-zinc-600 text-sm">
            Aucune pièce en attente de commande
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-2 text-left">Pièce</th>
                  <th className="px-4 py-2 text-left">Référence</th>
                  <th className="px-4 py-2 text-left">Fournisseur</th>
                  <th className="px-4 py-2 text-right">Qté</th>
                  <th className="px-4 py-2 text-right">Prix estimé</th>
                  <th className="px-4 py-2 text-left">Intervention</th>
                </tr>
              </thead>
              <tbody>
                {piecesToOrder.map((piece, idx) => (
                  <tr key={piece.id} className={idx % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-950'}>
                    <td className="px-4 py-2.5 text-zinc-200 font-medium">{piece.pieceName}</td>
                    <td className="px-4 py-2.5 text-zinc-500 text-xs font-mono">{piece.partNumber ?? '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{piece.supplier ?? '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-300 text-right">{piece.quantity ?? 1}</td>
                    <td className="px-4 py-2.5 text-zinc-300 text-right">
                      {piece.estimatedPrice != null
                        ? `${piece.estimatedPrice.toLocaleString('fr-BE')} €`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 text-xs">#{piece.interventionId}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-800">
                  <td colSpan={4} className="px-4 py-2.5 text-xs text-zinc-500">Total estimé</td>
                  <td className="px-4 py-2.5 text-right text-zinc-200 font-semibold text-sm">
                    {piecesToOrder
                      .filter(p => p.estimatedPrice != null)
                      .reduce((sum, p) => sum + (p.estimatedPrice ?? 0) * (p.quantity ?? 1), 0)
                      .toLocaleString('fr-BE')} €
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* AI Recommendations info */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm">
        <h2 className="text-zinc-300 font-medium mb-2">Comment utiliser l&apos;Atelier</h2>
        <ul className="text-zinc-500 space-y-1.5 text-xs list-disc list-inside">
          <li>
            <span className="text-zinc-400">Auto-création :</span> quand vous marquez un véhicule comme{' '}
            <strong className="text-zinc-300">Acheté</strong> dans le Stock, une intervention{' '}
            <em>Préparation à la vente</em> est automatiquement créée ici.
          </li>
          <li>
            <span className="text-zinc-400">Frais réels :</span> renseignez le coût réel de l&apos;intervention — le
            Contrôleur recalcule la marge nette et ajuste la recommandation de prix de vente.
          </li>
          <li>
            <span className="text-zinc-400">Pièces :</span> ajoutez les pièces via l&apos;API{' '}
            <code className="bg-zinc-800 px-1 rounded">/api/atelier/pieces</code> — les messages fournisseurs
            (WhatsApp/email) sont générés automatiquement.
          </li>
          <li>
            <span className="text-zinc-400">RDV :</span> planifiez livraisons, essais et reprises via{' '}
            <code className="bg-zinc-800 px-1 rounded">/api/atelier/rdvs</code>.
          </li>
        </ul>
      </section>
    </div>
  );
}
