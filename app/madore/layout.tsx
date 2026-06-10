import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GP-CARS · Conseiller en ligne',
  description: 'Trouvez votre véhicule idéal avec MADORE, le conseiller en ligne GP-CARS. SUV, citadines premium, boîtes automatiques — véhicules récents, peu kilométrés, historique clair.',
  openGraph: {
    title: 'GP-CARS · Votre conseiller en ligne',
    description: 'Parlez à MADORE, notre conseiller IA disponible 24h/24. Trouvez votre prochain véhicule en quelques minutes.',
    siteName: 'GP-CARS',
    locale: 'fr_BE',
    type: 'website',
  },
};

export default function MadoreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
