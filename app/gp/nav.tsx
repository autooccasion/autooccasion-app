import Link from 'next/link';

type Tab = 'stock' | 'achats' | 'dashboard' | 'leads' | 'training' | 'atelier' | 'garantie' | 'mandats' | 'system';

const tabs: { key: Tab; label: string; href: string; description: string }[] = [
  { key: 'stock',    label: 'Stock',      href: '/gp/stock',     description: 'Source de vérité' },
  { key: 'achats',   label: 'Achats',     href: '/carmelo',      description: 'Agent Carmelo' },
  { key: 'dashboard',label: 'Dashboard',  href: '/gp/dashboard', description: 'Analytics' },
  { key: 'leads',    label: 'Leads',      href: '/gp/leads',     description: 'Agent MADORE' },
  { key: 'training', label: 'Formation',  href: '/gp/training',  description: 'Entraînement agents' },
  { key: 'atelier',  label: 'Atelier',    href: '/gp/atelier',   description: 'Agent Mécanique & RDV' },
  { key: 'garantie', label: 'Garantie',   href: '/gp/garantie',  description: 'Agent SAV & Litiges' },
  { key: 'mandats',  label: 'Mandats',    href: '/gp/mandats',   description: 'Acquisition de mandats VO' },
  { key: 'system',   label: 'Système',    href: '/gp/system',    description: 'Santé des agents' },
];

export default function GPNav({ active }: { active: Tab }) {
  return (
    <nav className="flex gap-1 border-b border-zinc-800 pb-px overflow-x-auto scrollbar-none">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          title={tab.description}
          className={`px-3 py-2 text-sm rounded-t-md transition-colors whitespace-nowrap flex-shrink-0 ${
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
