import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import { getWarranties, getOpenWarrantyCases, getVehicles } from 'app/db';
import GPNav from '../nav';
import GarantieClient from './client';

export const dynamic = 'force-dynamic';

export default async function GarantiePage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const email = session.user.email;

  let warranties: Awaited<ReturnType<typeof getWarranties>> = [];
  let openCases: Awaited<ReturnType<typeof getOpenWarrantyCases>> = [];
  let vehicles: Awaited<ReturnType<typeof getVehicles>> = [];
  let loadError = false;

  try {
    [warranties, openCases, vehicles] = await Promise.all([
      getWarranties(email),
      getOpenWarrantyCases(email),
      getVehicles(email, 200),
    ]);
  } catch (err) {
    console.error('Garantie page: échec chargement', err);
    loadError = true;
  }

  const vehicleInfos = vehicles.map((v) => ({
    id: v.id,
    make: v.make ?? null,
    model: v.model ?? null,
    year: v.year ?? null,
  }));

  const now = new Date();
  const in30Days = new Date(now);
  in30Days.setDate(in30Days.getDate() + 30);

  const activeWarranties = warranties.filter((w) => w.active && new Date(w.legalExpiresAt) > now);
  const expiringWarranties = warranties.filter((w) => {
    const exp = new Date(w.legalExpiresAt);
    return w.active && exp > now && exp <= in30Days;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-5xl space-y-6">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">GP-CARS</h1>
          <p className="text-zinc-400 text-sm mt-1">Garanties — suivi légal et dossiers clients</p>
        </div>

        <GPNav active="garantie" />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KPI label="Garanties actives" value={activeWarranties.length} />
          <KPI label="Dossiers ouverts" value={openCases.length} />
          <KPI label="Expirent dans 30 j." value={expiringWarranties.length} />
        </div>

        {loadError && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg p-4 text-sm">
            Impossible de charger les garanties. Vérifiez la connexion à la base de données.
          </div>
        )}

        {!loadError && (
          <GarantieClient
            initialWarranties={warranties}
            initialCases={openCases}
            vehicles={vehicleInfos}
          />
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
