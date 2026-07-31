import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Garagentor',
    template: '%s · Garagentor',
  },
  description:
    'Branchensoftware für Garagentor-Fachbetriebe: Angebote, Aufträge, Rechnungen sowie ' +
    'Toranlagen mit wiederkehrender Prüfung nach ASR A1.7.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1e3247',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
