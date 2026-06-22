import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import GPNav from '../nav';
import MandatsClient from './MandatsClient';

export const dynamic = 'force-dynamic';

export default async function MandatsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-6 space-y-4">
      <GPNav active="mandats" />
      <MandatsClient />
    </div>
  );
}
