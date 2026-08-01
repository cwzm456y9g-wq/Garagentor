import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

/*
 * Das Prisma-CLI läuft mit apps/api als Arbeitsverzeichnis und sucht die .env
 * nur dort. Die Konfiguration des Monorepos liegt aber im Wurzelverzeichnis,
 * damit Compose, API und Web dieselben Werte verwenden – also wird sie hier
 * ausdrücklich nachgeladen.
 *
 * Eine fehlende Datei ist kein Fehler: im Container und in der CI stehen die
 * Werte bereits als echte Umgebungsvariablen bereit. Bestehende Variablen
 * werden von dotenv nicht überschrieben, die Umgebung hat also Vorrang.
 */
for (const candidate of ['.env', join('..', '..', '.env')]) {
  if (existsSync(candidate)) {
    loadEnv({ path: candidate, quiet: true });
  }
}

export default defineConfig({
  schema: join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'ts-node -P prisma/tsconfig.json prisma/seed.ts',
  },
});
