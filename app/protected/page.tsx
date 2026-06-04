import { auth, signOut } from 'app/auth';
import Link from 'next/link';

export default async function ProtectedPage() {
  let session = await auth();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center py-12 px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GP-CARS</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Connecté en tant que {session?.user?.email}
          </p>
        </div>

        <Link
          href="/carmelo"
          className="block w-full px-6 py-3 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
        >
          Ouvrir Carmelo — Agent d&apos;achat IA
        </Link>

        <div className="flex justify-center gap-4 text-sm">
          <Link href="/carmelo/history" className="text-zinc-400 underline hover:text-zinc-200">
            Historique
          </Link>
          <Link href="/settings" className="text-zinc-400 underline hover:text-zinc-200">
            Paramètres
          </Link>
        </div>

        <SignOut />
      </div>
    </div>
  );
}

function SignOut() {
  return (
    <form
      action={async () => {
        'use server';
        await signOut();
      }}
    >
      <button type="submit" className="text-zinc-500 text-sm hover:text-zinc-300 transition-colors">
        Se déconnecter
      </button>
    </form>
  );
}
