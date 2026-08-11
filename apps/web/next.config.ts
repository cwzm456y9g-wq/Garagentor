import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Für das Container-Image: Next legt einen eigenständigen Server samt der
  // tatsächlich benötigten node_modules unter .next/standalone ab.
  output: 'standalone',
  // Das Monorepo-Paket wird mitkompiliert, damit dieselbe Belegrechnung
  // in Frontend und Backend läuft.
  transpilePackages: ['@garagentor/shared'],
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  /**
   * Prismas Abfrage-Compiler als WebAssembly muss mit ins Paket.
   *
   * Seit die Abfragen ohne Prismas Rust-Anteil gebaut werden
   * (`engineType = "client"`, siehe prisma/schema.prisma), steckt die ganze
   * Arbeit in `query_compiler_bg.wasm` – knapp zwei Megabyte. Next.js
   * verfolgt beim Bau die `require`-Aufrufe und findet dabei die begleitende
   * .js-Datei, nicht aber die .wasm daneben: Die wird zur Laufzeit geladen,
   * und danach sucht die Verfolgung nicht.
   *
   * Bemerkbar macht sich das erst auf dem Server, und zwar als
   * „Invalid `prisma.$queryRaw()` invocation" ohne weitere Begründung –
   * während eine Verbindung von Hand tadellos funktioniert. Genau dieses Bild
   * hat einen Abend gekostet.
   */
  outputFileTracingIncludes: {
    '/**': ['../../node_modules/.prisma/client/*.wasm'],
  },
  eslint: {
    // Lint läuft über `npm run lint`, nicht im Build.
    ignoreDuringBuilds: true,
  },
};

export default config;
