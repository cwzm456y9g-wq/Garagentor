import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';
import { adressenBereinigen, tlsFuer } from './db-adresse';

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
/**
 * Verschlüsselung der Verbindung.
 *
 * Hier ist Vorsicht geboten: Prismas eigener Treiber verschlüsselte von sich
 * aus, `pg` tut das **nicht**. Ohne diese Einstellung liefen Passwort,
 * Kundendaten und Rechnungen im Klartext von Hostinger nach Frankfurt. Der
 * Wechsel des Treibers darf nicht heimlich die Verschlüsselung mitnehmen.
 *
 * Zwei Stufen, und der Unterschied gehört benannt:
 *
 *   ohne DATABASE_SSL_CA  Verschlüsselt, aber das Zertifikat der Gegenstelle
 *                         wird nicht geprüft. Mitlesen ist damit ausgeschlossen,
 *                         ein vorgetäuschter Server nicht. Das entspricht dem,
 *                         was Prismas Treiber bisher tat.
 *   mit DATABASE_SSL_CA   Vollständige Prüfung gegen das hinterlegte
 *                         Wurzelzertifikat. Supabase bietet es unter
 *                         Settings → Database → SSL Configuration zum
 *                         Herunterladen an; der Inhalt kommt als
 *                         Umgebungsvariable in hPanel, Zeilenumbrüche dürfen
 *                         als \n geschrieben sein.
 *
 * Steht in der Adresse selbst ein `sslmode`, gewinnt dieser: `pg` liest die
 * Adresse nach dieser Einstellung und überschreibt sie. Das ist gewollt – wer
 * es ausdrücklich hinschreibt, meint es auch so.
 *
 * Ausgenommen ist die eigene Maschine. Eine Datenbank auf `localhost` bietet
 * gewöhnlich gar kein TLS an; würde hier darauf bestanden, ließe sich die
 * Anwendung auf dem Entwicklungsrechner nicht mehr starten. Über diese
 * Verbindung geht ohnehin kein Kabel.
 */
function tlsEinstellung(): PoolConfig['ssl'] {
  return tlsFuer(process.env.DATABASE_URL, process.env.DATABASE_SSL_CA);
}

/**
 * Wie viele Verbindungen offen gehalten werden.
 *
 * Klein, und zwar aus zwei Richtungen: Supabase gibt auf dem kleinen Tarif nur
 * wenige Verbindungen her, und Hostinger kann den Node-Prozess mehrfach halten
 * – jeder mit eigenem Vorrat. Zehn (die Voreinstellung von `pg`) wären zu viel.
 */
const VERBINDUNGEN = Number.parseInt(process.env.DATABASE_POOL_MAX ?? '', 10) || 5;

/**
 * Wie lange eine einzelne Abfrage dauern darf, bevor sie abgebrochen wird.
 *
 * Wird nach außen gegeben, damit die Erreichbarkeitsauskunft ihre eigene
 * Geduld daran ausrichten kann. Das ist keine Feinheit: Gibt die obere Schicht
 * zuerst auf, meldet sie „Zeitüberschreitung" und verwirft dabei genau die
 * Begründung, die die untere gerade formuliert hätte. Wer zuerst aufgibt,
 * bestimmt die Meldung.
 */
export const ABFRAGE_GEDULD_MS = 20_000;

function clientErzeugen(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: tlsEinstellung(),
    max: VERBINDUNGEN,
    idleTimeoutMillis: 30_000,
    // Ohne diese Grenze wartet eine Abfrage bei erschöpftem Vorrat oder
    // stummem Netz endlos. Genau das erzeugte den 504 samt Neustartschleife:
    // Die Überwachung hielt den Prozess für hängend. Ein Fehler nach zehn
    // Sekunden ist besser als eine Antwort, die nie kommt.
    connectionTimeoutMillis: 10_000,

    // Die vorige Grenze deckt nur den Aufbau der Verbindung ab. Steht sie
    // erst, kann eine Abfrage weiterhin unbegrenzt hängen – und mit ihr die
    // Anmeldung, die darauf wartet. Diese Grenze wirkt im Client: Kommt keine
    // Antwort, bricht er von sich aus ab. Zwanzig Sekunden sind für jede
    // Abfrage dieser Anwendung reichlich; die längste – der Buchungsstapel
    // eines Jahres – bleibt weit darunter.
    query_timeout: ABFRAGE_GEDULD_MS,

    // Hier stand einmal zusätzlich `statement_timeout`, damit auch die
    // Datenbank selbst abbricht und nichts stehen bleibt. Das war ein Fehler,
    // und zwar ein teurer: `pg` reicht diesen Wert nicht als Befehl nach dem
    // Anmelden weiter, sondern **im Anmeldepaket** (siehe getStartupConf in
    // pg/lib/client.js). Zwischen uns und der Datenbank sitzt aber der
    // Supabase-Pooler, und ein Pooler kann mit unbekannten Anmeldeparametern
    // nichts anfangen – er muss sie auf eine gemeinsam genutzte Verbindung
    // abbilden. Die Anmeldung gelang daraufhin, und die erste Abfrage kam nie
    // zurück: keine Fehlermeldung, kein Abbruch, nur Warten.
    //
    // Eine serverseitige Grenze gehört deshalb nicht in die Verbindung,
    // sondern an die Rolle (ALTER ROLE … SET statement_timeout). Bis dahin
    // reicht die Grenze im Client – sie verhindert dasselbe, nur eine
    // Armlänge weiter vorn.
  });

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
