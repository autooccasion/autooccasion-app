import './globals.css';

import { GeistSans } from 'geist/font/sans';

const title = 'GP-CARS';
const description = 'Plateforme de gestion de stock automobile pour négociants.';

export const metadata = {
  title,
  description,
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={GeistSans.variable}>{children}</body>
    </html>
  );
}
