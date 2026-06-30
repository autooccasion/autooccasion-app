import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import { getGarageConfig, getGarageConfigOverrides } from 'app/db';
import { DEFAULT_GARAGE_CONFIG } from '@/lib/carmelo/garage-config';
import GPNav from '../nav';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const [config, overrides] = await Promise.all([
    getGarageConfig(session.user.email).catch(() => DEFAULT_GARAGE_CONFIG),
    getGarageConfigOverrides(session.user.email).catch(() => null),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GP-CARS</h1>
          <p className="text-zinc-400 text-sm mt-1">Réglages — configuration métier de votre garage</p>
        </div>
        <GPNav active="settings" />
        <SettingsClient config={config} hasOverrides={overrides != null} defaults={DEFAULT_GARAGE_CONFIG} />
      </div>
    </div>
  );
}
