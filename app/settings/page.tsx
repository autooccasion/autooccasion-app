import { cookies } from 'next/headers';
import { auth } from 'app/auth';
import { redirect } from 'next/navigation';
import { saveApiKey } from 'app/actions';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const configured = !!cookies().get('gp_api_key')?.value;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-lg space-y-8">

        <div>
          <h1 className="text-2xl font-bold">Paramètres GP-CARS</h1>
          <p className="text-zinc-400 text-sm mt-1">Configuration de Carmelo</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Clé API Anthropic</h2>
            {configured ? (
              <span className="text-green-400 text-sm">&#10003; Configurée</span>
            ) : (
              <span className="text-red-400 text-sm">&#10007; Manquante</span>
            )}
          </div>

          <p className="text-zinc-400 text-sm">
            Carmelo utilise l&apos;intelligence artificielle d&apos;Anthropic pour analyser les
            véhicules. Entrez votre clé ci-dessous.
          </p>

          <p className="text-xs text-zinc-500">
            Où trouver la clé :{' '}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-300 underline"
            >
              console.anthropic.com/settings/keys
            </a>
          </p>

          <form action={saveApiKey} className="space-y-3">
            <input
              type="password"
              name="apiKey"
              required
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              placeholder="sk-ant-..."
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
            >
              {configured ? 'Mettre à jour la clé' : 'Enregistrer la clé'}
            </button>
          </form>
        </div>

        <a
          href="/carmelo"
          className="block text-center text-zinc-400 underline text-sm hover:text-zinc-200"
        >
          &#8592; Retour à Carmelo
        </a>

      </div>
    </div>
  );
}
