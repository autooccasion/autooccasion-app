import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import { getLeads, updateLeadStatus } from 'app/db';
import GPNav from '../nav';

export const dynamic = 'force-dynamic';

const PRIORITY_STYLE: Record<string, string> = {
  ROUGE:  'bg-red-950 text-red-300 border-red-800',
  ORANGE: 'bg-orange-950 text-orange-300 border-orange-800',
  VERT:   'bg-green-950 text-green-300 border-green-800',
};

const STATUS_LABELS: Record<string, string> = {
  nouveau:  'Nouveau',
  contacte: 'Contacté',
  conclu:   'Conclu',
  perdu:    'Perdu',
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
}

async function setStatus(formData: FormData) {
  'use server';
  const session = await auth();
  if (!session?.user?.email) return;
  const id   = Number(formData.get('id'));
  const status = String(formData.get('status') ?? '');
  if (id > 0 && status) await updateLeadStatus(id, session.user.email, status);
}

export default async function LeadsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const leads = await getLeads(session.user.email, 200).catch(() => []);

  const chauds  = leads.filter((l) => l.priority === 'ROUGE');
  const suivis  = leads.filter((l) => l.priority === 'ORANGE');
  const faibles = leads.filter((l) => l.priority === 'VERT' || !l.priority);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-5xl space-y-6">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads MADORE</h1>
          <p className="text-sm text-zinc-400 mt-1">Prospects qualifiés par l&apos;agent commercial</p>
        </div>

        <GPNav active="leads" />

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-950 border border-red-800 rounded-lg p-4">
            <p className="text-xs text-red-400">Très chauds</p>
            <p className="text-2xl font-bold text-red-300">{chauds.length}</p>
          </div>
          <div className="bg-orange-950 border border-orange-800 rounded-lg p-4">
            <p className="text-xs text-orange-400">À suivre</p>
            <p className="text-2xl font-bold text-orange-300">{suivis.length}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
            <p className="text-xs text-zinc-400">Faible priorité</p>
            <p className="text-2xl font-bold text-zinc-300">{faibles.length}</p>
          </div>
        </div>

        {leads.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-8 text-center">
            <p className="text-zinc-400 text-sm">Aucun lead pour l&apos;instant.</p>
            <p className="text-zinc-600 text-xs mt-1">Les prospects qualifiés par MADORE apparaissent ici.</p>
          </div>
        )}

        <div className="space-y-3">
          {leads.map((lead) => {
            const priority = lead.priority ?? 'VERT';
            const status   = lead.status   ?? 'nouveau';
            return (
              <div
                key={lead.id}
                className={`bg-zinc-900 border rounded-lg p-5 space-y-3 ${
                  status === 'perdu' ? 'border-zinc-800 opacity-60' : 'border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-zinc-100">
                        {lead.prospectName || 'Prospect anonyme'}
                      </p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.VERT}`}>
                        {priority}
                      </span>
                      {lead.score != null && (
                        <span className="text-xs text-zinc-500">Score {lead.score}/100</span>
                      )}
                      <span className="text-xs text-zinc-600">{STATUS_LABELS[status] ?? status}</span>
                    </div>
                    <div className="flex gap-4 flex-wrap">
                      {lead.prospectPhone && (
                        <a href={`tel:${lead.prospectPhone}`} className="text-sm text-blue-400 hover:text-blue-300 font-mono">
                          {lead.prospectPhone}
                        </a>
                      )}
                      {lead.prospectEmail && (
                        <a href={`mailto:${lead.prospectEmail}`} className="text-sm text-zinc-400 hover:text-zinc-200">
                          {lead.prospectEmail}
                        </a>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-600 shrink-0">{formatDate(lead.createdAt)}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-zinc-500">Véhicule</p>
                    <p className="text-zinc-200">{lead.vehicleSearch || '—'}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Budget</p>
                    <p className="text-zinc-200">{lead.budget != null ? `${lead.budget.toLocaleString('fr-BE')} €` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Délai</p>
                    <p className="text-zinc-200">{lead.buyDelay || '—'}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Proba. vente</p>
                    <p className={`font-semibold ${(lead.saleProbability ?? 0) >= 75 ? 'text-green-400' : (lead.saleProbability ?? 0) >= 50 ? 'text-orange-400' : 'text-zinc-400'}`}>
                      {lead.saleProbability != null ? `${lead.saleProbability} %` : '—'}
                    </p>
                  </div>
                </div>

                {lead.summary && (
                  <p className="text-xs text-zinc-400 bg-zinc-950 rounded p-2 border border-zinc-800">
                    {lead.summary}
                  </p>
                )}

                {lead.actionRecommended && (
                  <p className="text-xs text-yellow-400">
                    ▶ {lead.actionRecommended}
                  </p>
                )}

                <div className="flex gap-2 flex-wrap">
                  {status !== 'contacte' && (
                    <form action={setStatus}>
                      <input type="hidden" name="id" value={lead.id} />
                      <input type="hidden" name="status" value="contacte" />
                      <button type="submit" className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg transition-colors">
                        ✓ Marquer contacté
                      </button>
                    </form>
                  )}
                  {status !== 'conclu' && (
                    <form action={setStatus}>
                      <input type="hidden" name="id" value={lead.id} />
                      <input type="hidden" name="status" value="conclu" />
                      <button type="submit" className="px-3 py-1.5 bg-green-950 hover:bg-green-900 border border-green-800 text-green-300 text-xs rounded-lg transition-colors">
                        🎉 Conclu
                      </button>
                    </form>
                  )}
                  {status !== 'perdu' && (
                    <form action={setStatus}>
                      <input type="hidden" name="id" value={lead.id} />
                      <input type="hidden" name="status" value="perdu" />
                      <button type="submit" className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-500 text-xs rounded-lg transition-colors">
                        Perdu
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
