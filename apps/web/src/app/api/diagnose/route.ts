import { lookup } from 'node:dns/promises';
import { createConnection } from 'node:net';
import { timingSafeEqual } from 'node:crypto';
import { json } from '@/server/antwort';
import { offen } from '@/server/anmeldung';
import { prisma } from '@/server/prisma';
import { untersuche } from '@/server/db-adresse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sagt in einem Zug, warum die Datenbank nicht erreichbar ist.
 *
 * Entstanden aus einer Inbetriebnahme, bei der jede Vermutung eine eigene
 * Rückfrage kostete: Port? Passwort? Sonderzeichen? Rechnername? Jede Antwort
 * brachte ein Bit, und dazwischen lagen Minuten. Diese Auskunft beantwortet
 * alle vier Fragen auf einmal, und zwar von dort aus, wo es darauf ankommt –
 * vom Server selbst.
 *
 * Sie prüft vier Stufen, jede baut auf der vorigen auf:
 *
 *   1. Adresse    Lässt sich die Zeichenkette überhaupt lesen? Stecken
 *                 Anführungszeichen, Klammern oder Platzhalter darin?
 *   2. Name       Löst der Rechnername auf?
 *   3. Netz       Nimmt jemand auf diesem Port eine Verbindung an?
 *   4. Anmeldung  Lässt die Datenbank uns herein?
 *
 * Die erste Stufe, die scheitert, benennt die Ursache. Das Passwort verlässt
 * den Server dabei nicht – nur seine Länge und, falls auffällig, ein Hinweis.
 *
 * Geschützt über CRON_SECRET, weil hier Rechnernamen und Benutzer stehen.
 * Wenn alles läuft, darf diese Datei ersatzlos verschwinden.
 */

const NETZ_GEDULD_MS = 5000;

function schluesselStimmt(angefragt: string | null): boolean {
  const erwartet = process.env.CRON_SECRET;
  if (!erwartet || !angefragt) return false;
  const a = Buffer.from(angefragt);
  const b = Buffer.from(erwartet);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Öffnet kurz eine Verbindung, nur um zu sehen, ob jemand annimmt. */
function netzpruefung(
  rechner: string,
  port: number,
): Promise<{ ergebnis: string; dauerMs: number }> {
  const start = Date.now();

  return new Promise((erfuellen) => {
    const verbindung = createConnection({ host: rechner, port });
    const fertig = (ergebnis: string) => {
      verbindung.destroy();
      erfuellen({ ergebnis, dauerMs: Date.now() - start });
    };

    verbindung.setTimeout(NETZ_GEDULD_MS);
    verbindung.once('connect', () => fertig('offen – es nimmt jemand an'));
    verbindung.once('timeout', () =>
      fertig('Zeitüberschreitung – die Pakete verschwinden, typisch für einen gesperrten Port'),
    );
    verbindung.once('error', (fehler: NodeJS.ErrnoException) =>
      fertig(
        fehler.code === 'ECONNREFUSED'
          ? 'abgelehnt – der Port ist erreichbar, aber niemand hört darauf'
          : `Fehler: ${fehler.code ?? fehler.message}`,
      ),
    );
  });
}

export const GET = offen(async (anfrage: Request) => {
  const url = new URL(anfrage.url);
  if (!schluesselStimmt(url.searchParams.get('schluessel'))) {
    return json({ fehler: 'Schlüssel fehlt oder stimmt nicht.' }, 403);
  }

  const stufen: Record<string, unknown> = {};

  /* 1 – Adresse ------------------------------------------------------- */
  const adresse = untersuche(process.env.DATABASE_URL);
  stufen['1_adresse'] = adresse;
  if ('fehler' in adresse) {
    return json({ ergebnis: 'Die Adresse ist unbrauchbar.', stufen });
  }

  /* 2 – Namensauflösung ----------------------------------------------- */
  try {
    const treffer = await lookup(adresse.rechner, { all: true });
    stufen['2_name'] = treffer.map((t) => `${t.address} (IPv${t.family})`);
  } catch (fehler) {
    stufen['2_name'] = `nicht auflösbar: ${fehler instanceof Error ? fehler.message : 'unbekannt'}`;
    return json({ ergebnis: 'Der Rechnername löst nicht auf.', stufen });
  }

  /* 3 – Erreichbarkeit ------------------------------------------------ */
  const port = Number.parseInt(adresse.port, 10);
  if (Number.isFinite(port)) {
    stufen['3_netz'] = await netzpruefung(adresse.rechner, port);
  }

  /* 4 – Anmeldung ----------------------------------------------------- */
  try {
    await prisma.$queryRaw`SELECT 1`;
    stufen['4_anmeldung'] = 'ok';
    return json({ ergebnis: 'Alles in Ordnung – die Datenbank antwortet.', stufen });
  } catch (fehler) {
    const meldung = fehler instanceof Error ? fehler.message : String(fehler);
    stufen['4_anmeldung'] = meldung.split('\n').slice(0, 6).join(' ').slice(0, 500);
    return json({ ergebnis: 'Die Datenbank lehnt die Anmeldung ab.', stufen });
  }
});
