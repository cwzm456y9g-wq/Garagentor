import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
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
