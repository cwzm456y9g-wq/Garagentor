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
  eslint: {
    // Lint läuft über `npm run lint`, nicht im Build.
    ignoreDuringBuilds: true,
  },
};

export default config;
