import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { adressenBereinigen } from './db-adresse';

// Vor allem anderen: Die Adressen aus der Umgebung von dem befreien, was beim
// Kopieren aus einer Anleitung mitkommt – umschließende Anführungszeichen,
// ein vorangestelltes `DATABASE_URL=`, Leerzeichen an den Rändern. Prisma
// liest die Umgebung selbst, also muss das geschehen, bevor der Client
// entsteht.
adressenBereinigen();

/**
 * Prisma spricht hier über einen Treiber in JavaScript, nicht über seinen
 * eigenen in Rust.
 *
 * Das ist keine Geschmacksfrage. Der mitgelieferte Rust-Treiber ist auf
 * Hostingers geteiltem Webhosting nicht lauffähig: Er meldet
 *
 *   PANIC: timer has gone away
 *
 * und bricht jede Abfrage ab. Der Fehler ist bei Prisma seit Jahren gemeldet
 * und tritt gehäuft auf cPanel- und Hostinger-Tarifen auf – die Umgebung dort
 * beschränkt Prozesse und Zeitgeber so weit, dass die Rust-Laufzeit ihre
 * eigenen Timer verliert. Von außen sieht das aus wie eine abgelehnte
 * Anmeldung, obwohl die Verbindung längst steht.
 *
 * Der Weg über `pg` ist reines JavaScript. Damit verschwindet nicht nur
 * dieser Absturz, sondern die ganze Gattung: Vorher hatte schon die
 * kompilierte Prisma-Bibliothek nicht zur OpenSSL-Version des Servers gepasst.
 * Was es nicht gibt, kann auch nicht unpassend sein.
 */
function clientErzeugen(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

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

export const prisma = anker.prismaClient ?? clientErzeugen();

if (process.env.NODE_ENV !== 'production') {
  anker.prismaClient = prisma;
}
