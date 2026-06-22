import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import { getOpenWorkshopJobs, getVehicles } from 'app/db';
import GPNav from '../nav';
import AtelierClient from './client';

export const dynamic = 'force-dynamic';

export default async function AtelierPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const email = session.user.email;

  let jobs: Awaited<ReturnType<typeof getOpenWorkshopJobs>> = [];
  let vehicles: Awaited<ReturnType<typeof getVehicles>> = [];
  let loadError = false;

  try {
    [jobs, vehicles] = await Promise.all([
      getOpenWorkshopJobs(email),
      getVehicles(email, 200),
    ]);
  } catch (err) {
    console.error('Atelier page: échec chargement', err);
    loadError = true;
  }

  const vehicleInfos = vehicles.map((v) => ({
    id: v.id,
    make: v.make ?? null,
    model: v.model ?? null,
    year: v.year ?? null,
  }));

  const totalEstimated = jobs.reduce((s, j) => s + (j.estimatedCost ?? 0), 0);
  const vehiclesWithJobs = new Set(jobs.map((j) => j.vehicleId)).size;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-5xl space-y-6">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">GP-CARS</h1>
          <p className="text-zinc-400 text-sm mt-1">Atelier — préparation et travaux véhicules</p>
        </div>

        <GPNav active="atelier" />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KPI label="Travaux en cours" value={jobs.length} />
          <KPI label="Véhicules concernés" value={vehiclesWithJobs} />
          <KPI label="Coût estimé total" value={totalEstimated > 0 ? `${totalEstimated.toLocaleString('fr-BE')} €` : '—'} />
        </div>

        {loadError && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg p-4 text-sm">
            Impossible de charger les travaux. Vérifiez la connexion à la base de données.
          </div>
        )}

        {!loadError && (
          <AtelierClient initialJobs={jobs} vehicles={vehicleInfos} />
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
