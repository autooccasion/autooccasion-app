import Link from 'next/link';

type Tab = 'stock' | 'achats' | 'dashboard' | 'leads';

const tabs: { key: Tab; label: string; href: string; description: string }[] = [
  { key: 'stock',     label: 'Stock',       href: '/gp/stock',     description: 'Source de vérité' },
  { key: 'achats',    label: 'Achats',      href: '/carmelo',      description: 'Agent Carmelo' },
  { key: 'dashboard', label: 'Dashboard',   href: '/gp/dashboard', description: 'Analytics' },
  { key: 'leads',     label: 'Leads',       href: '/gp/leads',     description: 'Agent MADORE' },
];

export default function GPNav({ active }: { active: Tab }) {
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
