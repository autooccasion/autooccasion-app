import Link from 'next/link';

type Tab = 'analyser' | 'historique' | 'parametres';

const tabs: { key: Tab; label: string; href: string }[] = [
  { key: 'analyser', label: 'Analyser', href: '/carmelo' },
  { key: 'historique', label: 'Historique', href: '/carmelo/history' },
  { key: 'parametres', label: 'Paramètres', href: '/settings' },
];

export default function CarmeloNav({ active }: { active: Tab }) {
  return (
    <nav className="flex gap-1 border-b border-zinc-800 pb-px">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`px-4 py-2 text-sm rounded-t-md transition-colors ${
            active === tab.key
              ? 'bg-zinc-900 text-zinc-100 border-b-2 border-white -mb-px'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
