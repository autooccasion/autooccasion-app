import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import { getGarantieDossiers, getGarantieStats } from 'app/db';
import type { GarantieDossierRecord } from 'app/db';
import GPNav from '../nav';

export const dynamic = 'force-dynamic';

// ─── helpers ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  nouveau:         'Nouveau',
  en_analyse:      'En analyse',
  decision_prise:  'Décision prise',
  sav_en_cours:    'SAV en cours',
  resolu:          'Résolu',
  litige:          'Litige',
  expertise:       'Expertise',
  procedure:       'Procédure',
};

const STATUS_COLORS: Record<string, string> = {
  nouveau:         'bg-zinc-800 text-zinc-400 border-zinc-700',
  en_analyse:      'bg-blue-950 text-blue-300 border-blue-800',
  decision_prise:  'bg-amber-950 text-amber-300 border-amber-800',
  sav_en_cours:    'bg-orange-950 text-orange-300 border-orange-800',
  resolu:          'bg-green-950 text-green-300 border-green-800',
  litige:          'bg-red-950 text-red-300 border-red-800',
  expertise:       'bg-purple-950 text-purple-300 border-purple-800',
  procedure:       'bg-red-950 text-red-200 border-red-700',
};

const COVERAGE_LABELS: Record<string, string> = {
  totale:     '✓ Totale',
  partielle:  '◑ Partielle',
  refusee:    '✗ Refusée',
  en_attente: '— En attente',
};

const COVERAGE_COLORS: Record<string, string> = {
  totale:     'text-green-400',
  partielle:  'text-amber-400',
  refusee:    'text-red-400',
  en_attente: 'text-zinc-500',
};

const CATEGORY_LABELS: Record<string, string> = {
  '1': '1 — Défaut de conformité',
  '2': '2 — Garantie applicable',
  '3': '3 — Garantie partielle',
  '4': '4 — Usure normale',
  '5': '5 — Défaut entretien',
  '6': '6 — Mauvaise utilisation',
  '7': '7 — Expertise requise',
};

function riskColor(score: number | null): string {
  if (score == null) return 'text-zinc-600';
  if (score >= 70) return 'text-red-400 font-semibold';
  if (score >= 40) return 'text-amber-400';
  return 'text-green-400';
}

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function monthsSince(d: Date | string | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / (30 * 24 * 60 * 60 * 1000));
}

// ─── sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className={`text-2xl font-bold ${color ?? 'text-zinc-100'}`}>{value}</div>
      <div className="text-sm text-zinc-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-zinc-600 mt-1">{sub}</div>}
    </div>
  );
}

function RiskBar({ score, label }: { score: number | null; label: string }) {
  if (score == null) return <span className="text-zinc-700">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full ${score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-amber-500' : 'bg-green-500'}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs ${riskColor(score)}`}>{score}</span>
    </div>
  );
}

function DossierRow({ d }: { d: GarantieDossierRecord }) {
  const months = monthsSince(d.saleDate);
  const inWarranty = months != null && months <= (d.warrantyDurationMonths ?? 12);
  const inPresumption = months != null && months <= 6;

  return (
    <tr className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-zinc-200 text-sm">
          {d.vehicleMake ?? '?'} {d.vehicleModel ?? '?'} {d.vehicleYear ? `(${d.vehicleYear})` : ''}
        </div>
        {d.vehicleVin && (
          <div className="text-xs text-zinc-600 font-mono mt-0.5">{d.vehicleVin}</div>
        )}
        {d.vehicleKmAtSale && d.vehicleKmNow && (
          <div className="text-xs text-zinc-500 mt-0.5">
            +{(d.vehicleKmNow - d.vehicleKmAtSale).toLocaleString('fr-BE')} km depuis vente
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-zinc-300">{d.customerName ?? '—'}</div>
        {d.customerPhone && <div className="text-xs text-zinc-600 mt-0.5">{d.customerPhone}</div>}
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-zinc-400">{formatDate(d.claimDate)}</div>
        <div className="text-xs mt-0.5">
          {inPresumption ? (
            <span className="text-amber-400">Présomption active</span>
          ) : inWarranty ? (
            <span className="text-green-400">Garantie en cours</span>
          ) : (
            <span className="text-zinc-600">Hors garantie</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {d.category ? (
          <span className="text-xs text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded">
            Cat. {d.category}
          </span>
        ) : (
          <span className="text-xs text-zinc-700">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className={`text-sm font-medium ${COVERAGE_COLORS[d.coverageDecision ?? 'en_attente']}`}>
          {COVERAGE_LABELS[d.coverageDecision ?? 'en_attente']}
        </div>
        {d.coveragePercent != null && d.coveragePercent < 100 && (
          <div className="text-xs text-zinc-500 mt-0.5">
            {d.coveragePercent}% pris en charge
            {d.clientContribution ? ` · Client : ${d.clientContribution.toLocaleString('fr-BE')} €` : ''}
          </div>
        )}
      </td>
      <td className="px-4 py-3 space-y-1.5">
        <RiskBar score={d.riskScoreLegal} label="Juridique" />
        <RiskBar score={d.litigationProbability} label="Litige" />
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[d.status ?? 'nouveau']}`}>
          {STATUS_LABELS[d.status ?? 'nouveau']}
        </span>
        {d.confidenceLevel != null && (
          <div className="text-xs text-zinc-600 mt-1">Conf. {d.confidenceLevel}%</div>
        )}
      </td>
    </tr>
  );
}

// ─── page ───────────────────────────────────────────────────────────────────

export default async function GarantiePage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const email = session.user.email;

  const [dossiers, stats] = await Promise.all([
    getGarantieDossiers(email),
    getGarantieStats(email),
  ]);

  const litiges = dossiers.filter(d => ['litige', 'expertise', 'procedure'].includes(d.status ?? ''));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      <GPNav active="garantie" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Garantie — Agent SAV & Litiges</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Gestion des garanties selon le droit belge · Analyse IA des dossiers · Préparation des litiges
          </p>
        </div>
        <span className="text-xs bg-green-950 border border-green-800 text-green-400 px-2 py-0.5 rounded-full font-semibold">
          ● v1.0
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Total dossiers" value={stats.total} />
        <StatCard label="Actifs" value={stats.actifs} color="text-blue-300" />
        <StatCard label="Litiges" value={stats.litiges} color={stats.litiges > 0 ? 'text-red-400' : 'text-zinc-400'} />
        <StatCard label="Résolus" value={stats.resolus} color="text-green-400" />
        <StatCard
          label="Coût total SAV"
          value={`${stats.coutTotal.toLocaleString('fr-BE')} €`}
          color="text-zinc-200"
        />
        <StatCard
          label="Coût moyen"
          value={stats.coutMoyen > 0 ? `${stats.coutMoyen.toLocaleString('fr-BE')} €` : '—'}
          color="text-zinc-200"
        />
        <StatCard
          label="Taux prise en charge"
          value={stats.total > 0 ? `${stats.tauxPriseEnCharge}%` : '—'}
          color={stats.tauxPriseEnCharge > 60 ? 'text-amber-300' : 'text-green-400'}
        />
      </div>

      {/* Litiges alert */}
      {litiges.length > 0 && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-4">
          <div className="text-red-300 font-semibold text-sm mb-1">
            ⚠ {litiges.length} dossier{litiges.length > 1 ? 's' : ''} en litige / expertise / procédure
          </div>
          <div className="text-red-400 text-xs space-y-0.5">
            {litiges.map(d => (
              <div key={d.id}>
                · {d.vehicleMake} {d.vehicleModel} ({d.customerName ?? '?'}) —{' '}
                <span className="capitalize">{STATUS_LABELS[d.status ?? '']}</span>
                {d.riskScoreFinancial != null && ` · Risque financier : ${d.riskScoreFinancial}/100`}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dossier table */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Tous les dossiers ({dossiers.length})
        </h2>
        {dossiers.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center text-zinc-500">
            <p className="text-lg mb-2">Aucun dossier de garantie</p>
            <p className="text-sm mb-4">Créez un dossier via l&apos;API pour commencer l&apos;analyse.</p>
            <code className="text-xs bg-zinc-800 px-3 py-1.5 rounded font-mono text-zinc-300">
              POST /api/garantie/dossiers
            </code>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left">Véhicule</th>
                  <th className="px-4 py-2.5 text-left">Client</th>
                  <th className="px-4 py-2.5 text-left">Réclamation</th>
                  <th className="px-4 py-2.5 text-left">Catégorie</th>
                  <th className="px-4 py-2.5 text-left">Décision</th>
                  <th className="px-4 py-2.5 text-left">Risques</th>
                  <th className="px-4 py-2.5 text-left">Statut</th>
                </tr>
              </thead>
              <tbody>
                {dossiers.map(d => (
                  <DossierRow key={d.id} d={d} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* KPI par catégorie */}
      {dossiers.some(d => d.category) && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Répartition par catégorie
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {(['1','2','3','4','5','6','7'] as const).map(cat => {
              const count = dossiers.filter(d => d.category === cat).length;
              return (
                <div key={cat} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-zinc-200">{count}</div>
                  <div className="text-xs text-zinc-500 mt-0.5 leading-tight">
                    {CATEGORY_LABELS[cat]}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* API Guide */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 text-sm space-y-3">
        <h2 className="text-zinc-300 font-medium">Utilisation de l&apos;Agent Garantie</h2>
        <div className="grid md:grid-cols-2 gap-4 text-xs text-zinc-500">
          <div>
            <div className="text-zinc-400 font-medium mb-1.5">1. Créer un dossier</div>
            <pre className="bg-zinc-950 rounded p-2.5 text-zinc-400 overflow-x-auto leading-relaxed">{`POST /api/garantie/dossiers
{
  "vehicleMake": "Volkswagen",
  "vehicleModel": "Golf",
  "vehicleYear": 2019,
  "vehicleKmAtSale": 85000,
  "vehicleKmNow": 93000,
  "saleDate": "2024-01-15",
  "warrantyDurationMonths": 12,
  "customerName": "Martin Dupont",
  "customerPhone": "0471 12 34 56",
  "claimDescription": "Boîte de vitesses qui saute",
  "symptoms": "Difficulté à passer 2ème et 3ème"
}`}</pre>
          </div>
          <div>
            <div className="text-zinc-400 font-medium mb-1.5">2. Lancer l&apos;analyse IA</div>
            <pre className="bg-zinc-950 rounded p-2.5 text-zinc-400 overflow-x-auto leading-relaxed">{`POST /api/garantie/analyze
{ "dossierId": 1 }

→ Retourne :
- Catégorie 1-7
- Scores de risque
- Analyse juridique
- Vétusté pièce par pièce
- Email client prêt à envoyer
- WhatsApp prêt à envoyer
- Dossier litige si nécessaire`}</pre>
          </div>
          <div>
            <div className="text-zinc-400 font-medium mb-1.5">3. Archiver une preuve</div>
            <pre className="bg-zinc-950 rounded p-2.5 text-zinc-400 overflow-x-auto leading-relaxed">{`POST /api/garantie/dossiers
{
  "action": "add_document",
  "dossierId": 1,
  "type": "diagnostic",
  "title": "Diagnostic OBD 14/06/2024",
  "addedBy": "garage"
}`}</pre>
          </div>
          <div>
            <div className="text-zinc-400 font-medium mb-1.5">4. Mettre à jour le statut</div>
            <pre className="bg-zinc-950 rounded p-2.5 text-zinc-400 overflow-x-auto leading-relaxed">{`POST /api/garantie/dossiers
{
  "action": "update",
  "id": 1,
  "status": "resolu",
  "finalCost": 450,
  "internalNotes": "Réparé sous garantie totale"
}`}</pre>
          </div>
        </div>
        <div className="text-zinc-600 text-xs border-t border-zinc-800 pt-3">
          Cadre légal : Code de droit économique belge · Directive 2019/771/UE ·
          Période de présomption 6 mois · Garantie légale minimale 1 an (occasion B2C)
        </div>
      </section>
    </div>
  );
}
