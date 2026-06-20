import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import { getRecentEvents } from 'app/db';
import { AGENT_REGISTRY, validateRegistry } from '@/lib/kernel/registry';
import GPNav from '../nav';

export const dynamic = 'force-dynamic';

type HealthStatus = {
  agent: string;
  version: string;
  status: 'online' | 'degraded' | 'offline';
  checks: Record<string, boolean>;
  timestamp: string;
  latencyMs: number;
};

async function fetchAgentHealth(
  agentName: string,
  endpoint: string,
  baseUrl: string,
): Promise<HealthStatus> {
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json();
    return { ...data, latencyMs: Date.now() - start };
  } catch {
    return {
      agent: agentName,
      version: '?',
      status: 'offline',
      checks: {},
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - start,
    };
  }
}

function StatusBadge({ status }: { status: HealthStatus['status'] }) {
  const styles = {
    online:   'bg-green-950 border-green-800 text-green-400',
    degraded: 'bg-yellow-950 border-yellow-800 text-yellow-400',
    offline:  'bg-red-950   border-red-800   text-red-400',
  };
  const labels = { online: '● En ligne', degraded: '◐ Dégradé', offline: '○ Hors ligne' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function AgentIcon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    carmelo:    '🛒',
    madore:     '💬',
    marketing:  '📢',
    controller: '🛡️',
    scanner:    '🔍',
    atelier:    '🔧',
  };
  return <span className="text-lg">{icons[name] ?? '🤖'}</span>;
}

function EventTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    'opportunite.or':    'text-yellow-400 bg-yellow-950 border-yellow-800',
    'opportunite.vert':  'text-green-400  bg-green-950  border-green-800',
    'lead.rouge':        'text-red-400    bg-red-950    border-red-800',
    'lead.orange':       'text-orange-400 bg-orange-950 border-orange-800',
    'stock.immobilise':  'text-yellow-400 bg-yellow-950 border-yellow-800',
    'prix.baisse':       'text-blue-400   bg-blue-950   border-blue-800',
    'vehicule.vendu':    'text-green-400  bg-green-950  border-green-800',
    'analyse.low_confidence': 'text-zinc-400 bg-zinc-800 border-zinc-700',
  };
  const style = colors[type] ?? 'text-zinc-400 bg-zinc-900 border-zinc-700';
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-mono ${style}`}>
      {type}
    </span>
  );
}

export default async function SystemPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

  // Fetch all agent health statuses in parallel
  const healthResults = await Promise.all(
    AGENT_REGISTRY.map((agent) =>
      fetchAgentHealth(agent.name, agent.healthEndpoint, baseUrl)
    )
  );

  // Recent events from the bus
  const recentEvents = await getRecentEvents(undefined, 30).catch(() => []);
  const pendingEvents = recentEvents.filter((e) => !e.processed);

  // Registry validation
  const { ok: registryOk, errors: registryErrors } = validateRegistry();

  // Aggregate stats
  const onlineCount  = healthResults.filter((h) => h.status === 'online').length;
  const degradedCount = healthResults.filter((h) => h.status === 'degraded').length;
  const offlineCount = healthResults.filter((h) => h.status === 'offline').length;

  // Event stats last 24h
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const events24h = recentEvents.filter((e) => new Date(e.createdAt!) > since24h);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-5xl space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Système multi-agents</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Santé des agents, bus d&apos;événements et intégrité de l&apos;architecture.
          </p>
        </div>

        <GPNav active="system" />

        {/* Global health bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-950 border border-green-800 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-green-400">{onlineCount}</p>
            <p className="text-xs text-zinc-400 mt-1">En ligne</p>
          </div>
          <div className={`border rounded-lg p-4 text-center ${degradedCount > 0 ? 'bg-yellow-950 border-yellow-800' : 'bg-zinc-900 border-zinc-800'}`}>
            <p className={`text-3xl font-bold ${degradedCount > 0 ? 'text-yellow-400' : 'text-zinc-500'}`}>{degradedCount}</p>
            <p className="text-xs text-zinc-400 mt-1">Dégradés</p>
          </div>
          <div className={`border rounded-lg p-4 text-center ${offlineCount > 0 ? 'bg-red-950 border-red-800' : 'bg-zinc-900 border-zinc-800'}`}>
            <p className={`text-3xl font-bold ${offlineCount > 0 ? 'text-red-400' : 'text-zinc-500'}`}>{offlineCount}</p>
            <p className="text-xs text-zinc-400 mt-1">Hors ligne</p>
          </div>
        </div>

        {/* Agents grid */}
        <Section title={`Agents enregistrés — ${AGENT_REGISTRY.length} agents`}>
          <div className="space-y-3">
            {AGENT_REGISTRY.map((agent, i) => {
              const health = healthResults[i];
              const failedChecks = Object.entries(health.checks).filter(([, ok]) => !ok);
              return (
                <div key={agent.name} className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <AgentIcon name={agent.name} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-zinc-100">{agent.displayName}</p>
                          <span className="text-xs text-zinc-500 font-mono">v{agent.version}</span>
                          <StatusBadge status={health.status} />
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">{agent.description}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-zinc-600">{health.latencyMs}ms</p>
                    </div>
                  </div>

                  {/* Events emitted / consumed */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-zinc-600 uppercase tracking-wide mb-1.5">Émet</p>
                      <div className="flex flex-wrap gap-1">
                        {agent.emits.length === 0
                          ? <span className="text-xs text-zinc-700">—</span>
                          : agent.emits.map((ev) => <EventTypeBadge key={ev} type={ev} />)
                        }
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-600 uppercase tracking-wide mb-1.5">Consomme</p>
                      <div className="flex flex-wrap gap-1">
                        {agent.consumes.length === 0
                          ? <span className="text-xs text-zinc-700">—</span>
                          : agent.consumes.map((ev) => <EventTypeBadge key={ev} type={ev} />)
                        }
                      </div>
                    </div>
                  </div>

                  {/* Failed checks */}
                  {failedChecks.length > 0 && (
                    <div className="mt-3 p-2 bg-red-950 border border-red-800 rounded text-xs text-red-400 space-y-0.5">
                      {failedChecks.map(([key]) => (
                        <p key={key}>✗ Variable manquante : <span className="font-mono">{key}</span></p>
                      ))}
                    </div>
                  )}

                  {/* Owned tables */}
                  {agent.owns.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-zinc-600">Tables :</span>
                      {agent.owns.map((t) => (
                        <span key={t} className="text-xs font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* Event bus */}
        <Section title="Bus d'événements">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Stat label="Événements (24h)" value={events24h.length} />
            <Stat label="En attente" value={pendingEvents.length} color={pendingEvents.length > 10 ? 'yellow' : 'default'} />
            <Stat label="Total enregistrés" value={recentEvents.length} />
            <Stat label="Types d'événements" value={new Set(recentEvents.map((e) => e.type)).size} />
          </div>

          {recentEvents.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              <p className="text-xs text-zinc-600 uppercase tracking-wide mb-2">30 derniers événements</p>
              {recentEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 py-1.5 border-b border-zinc-900">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ev.processed ? 'bg-zinc-700' : 'bg-yellow-400'}`} />
                  <EventTypeBadge type={ev.type} />
                  <span className="text-xs text-zinc-500 font-mono">{ev.source}</span>
                  <span className="text-xs text-zinc-700 ml-auto shrink-0">
                    {ev.createdAt ? new Date(ev.createdAt).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {recentEvents.length === 0 && (
            <p className="text-sm text-zinc-500">Aucun événement enregistré. Le bus démarrera à la première analyse.</p>
          )}
        </Section>

        {/* Registry validation */}
        <Section title="Validation de l'architecture">
          {registryOk ? (
            <div className="flex items-center gap-2 text-green-400">
              <span className="text-lg">✓</span>
              <p className="text-sm font-semibold">Architecture valide — aucun conflit détecté.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-400">
                <span className="text-lg">✗</span>
                <p className="text-sm font-semibold">{registryErrors.length} problème(s) détecté(s)</p>
              </div>
              {registryErrors.map((err, i) => (
                <p key={i} className="text-xs text-red-400 ml-7">{err}</p>
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
              <p className="text-xs text-zinc-500">Types émis (total)</p>
              <p className="text-xl font-bold mt-0.5">
                {AGENT_REGISTRY.flatMap((a) => [...a.emits]).length}
              </p>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
              <p className="text-xs text-zinc-500">Types consommés (total)</p>
              <p className="text-xl font-bold mt-0.5">
                {AGENT_REGISTRY.flatMap((a) => [...a.consumes]).length}
              </p>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
              <p className="text-xs text-zinc-500">Tables DB (total agents)</p>
              <p className="text-xl font-bold mt-0.5">
                {AGENT_REGISTRY.flatMap((a) => [...a.owns]).length}
              </p>
            </div>
          </div>
        </Section>

        {/* Add agent guide */}
        <Section title="Ajouter un nouvel agent">
          <p className="text-sm text-zinc-400 mb-3">
            Procédure standardisée — moins de 30 minutes pour enregistrer un nouvel agent.
          </p>
          <ol className="space-y-2 text-sm text-zinc-400 list-none">
            {[
              'Copier lib/agents/_template/ → lib/agents/<nom>/',
              'Remplir contract.ts : nom, version, events émis/consommés, tables',
              'Ajouter le contrat dans lib/kernel/registry.ts',
              'Créer app/api/<nom>/health/route.ts',
              'Implémenter la logique dans lib/agents/<nom>/index.ts',
              'Vérifier cette page — le nouvel agent apparaît automatiquement',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-xs flex items-center justify-center shrink-0 mt-0.5 text-zinc-400 font-mono">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
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

function Stat({ label, value, color = 'default' }: { label: string; value: number; color?: 'default' | 'yellow' | 'red' }) {
  const colors = {
    default: 'text-zinc-100',
    yellow:  'text-yellow-400',
    red:     'text-red-400',
  };
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${colors[color]}`}>{value}</p>
    </div>
  );
}
