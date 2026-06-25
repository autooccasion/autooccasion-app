import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import { getVehicles } from 'app/db';
import GPNav from '../nav';
import MarketingClient from './MarketingClient';

export const dynamic = 'force-dynamic';

export default async function MarketingPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  let vehicles: Awaited<ReturnType<typeof getVehicles>> = [];
  try {
    vehicles = await getVehicles(session.user.email, 200);
  } catch (err) {
    console.error('Marketing page: échec chargement', err);
  }

  const marketingVehicles = vehicles.filter(v =>
    ['en_stock', 'publie', 'achete'].includes(v.status ?? '')
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GP-CARS</h1>
          <p className="text-zinc-400 text-sm mt-1">Marketing — Agent Annonces VO</p>
        </div>
        <GPNav active="marketing" />
        <MarketingClient initialVehicles={marketingVehicles} />
      </div>
    </div>
  );
}
