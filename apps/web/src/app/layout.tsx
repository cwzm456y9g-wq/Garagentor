import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { DARSTELLUNG_SKRIPT } from '@/components/darstellung';
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
    // data-scroll-behavior: Next.js schaltet das weiche Scrollen beim
    // Seitenwechsel nur noch ab, wenn die Seite es ausdrücklich anmeldet.
    //
    // suppressHydrationWarning: das Skript unten setzt data-theme, bevor React
    // übernimmt. Der Server kann die Wahl nicht kennen – sie liegt im Browser –,
    // also weichen die Attribute zwangsläufig voneinander ab. React behält den
    // Wert aus dem Browser; unterdrückt wird nur die Warnung, und nur für dieses
    // eine Element.
    <html lang="de" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Setzt die gewählte Darstellung, bevor der erste Pixel steht – sonst
            blitzt bei dunkler Wahl kurz die helle Oberfläche auf. */}
        <script dangerouslySetInnerHTML={{ __html: DARSTELLUNG_SKRIPT }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
