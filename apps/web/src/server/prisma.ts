import { PrismaClient } from '@prisma/client';

/**
 * Eine einzige Prisma-Verbindung für den ganzen Prozess.
 *
 * Zwei Gründe für den Umweg über `globalThis`: In der Entwicklung lädt Next.js
 * Module bei jeder Änderung neu, und ohne diesen Anker entstünde bei jedem
 * Speichern ein weiterer Client samt eigenem Verbindungsvorrat – nach einer
 * Stunde Arbeit ist die Datenbank dicht. Im Betrieb bei Hostinger zählt
 * dasselbe aus anderem Grund: der Node-Prozess wird bei Bedarf gestartet und
 * kann mehrfach gehalten werden, und Supabase gibt auf dem kleinen Tarif nur
 * wenige Verbindungen her.
 */
const anker = globalThis as unknown as { prismaClient?: PrismaClient };

export const prisma =
  anker.prismaClient ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  anker.prismaClient = prisma;
}
