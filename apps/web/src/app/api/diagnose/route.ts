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
 *   1. Adresse       Lässt sich die Zeichenkette überhaupt lesen? Stecken
 *                    Anführungszeichen, Klammern oder Platzhalter darin?
 *   2. Name          Löst der Rechnername auf?
 *   3. Netz          Nimmt jemand auf diesem Port eine Verbindung an?
 *   4. Anmeldung     Lässt die Datenbank uns herein?
 *   5. Geheimnisse   Sind die Schlüssel gesetzt, mit denen Sitzungen
 *                    unterschrieben werden? Ohne sie scheitert jede Anmeldung
 *                    mit einem Serverfehler, obwohl die Datenbank steht.
 *   6. Konten        Gibt es überhaupt jemanden zum Anmelden – und ist das
 *                    Konto aktiv?
 *
 * Die erste Stufe, die scheitert, benennt die Ursache. Das Passwort verlässt
 * den Server dabei nicht – nur seine Länge und, falls auffällig, ein Hinweis.
 * Auch von den Geheimnissen wird nur gemeldet, ob sie taugen, nie ihr Wert.
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
  } catch (fehler) {
    const meldung = fehler instanceof Error ? fehler.message : String(fehler);
    stufen['4_anmeldung'] = meldung.split('\n').slice(0, 6).join(' ').slice(0, 500);
    return json({ ergebnis: 'Die Datenbank lehnt die Anmeldung ab.', stufen });
  }

  /* 5 – Geheimnisse --------------------------------------------------- */
  stufen['5_geheimnisse'] = Object.fromEntries(
    ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET'].map(
      (name) => [name, geheimnisBefund(process.env[name])],
    ),
  );

  /* 6 – Konten -------------------------------------------------------- */
  try {
    const konten = await prisma.user.findMany({
      select: { email: true, active: true, role: true },
      orderBy: { email: 'asc' },
      take: 20,
    });

    stufen['6_konten'] =
      konten.length === 0
        ? 'Es gibt kein einziges Konto. Ohne Konto ist keine Anmeldung möglich – die Demodaten oder ein Zugang müssen noch eingespielt werden.'
        : konten.map((k) => `${k.email} – ${k.role}${k.active ? '' : ' (STILLGELEGT)'}`);
  } catch (fehler) {
    stufen['6_konten'] =
      `nicht lesbar: ${fehler instanceof Error ? fehler.message.slice(0, 200) : 'unbekannt'}`;
  }

  return json({ ergebnis: 'Alles in Ordnung – die Datenbank antwortet.', stufen });
});

/**
 * Beurteilt ein Geheimnis, ohne es preiszugeben.
 *
 * Die Anwendung weigert sich im Produktivbetrieb zu starten, wenn eines fehlt,
 * noch den Entwicklungswert trägt oder zu kurz ist. Aus dem Browser sieht man
 * davon nur einen Serverfehler bei der Anmeldung – hier steht, welches es war.
 */
function geheimnisBefund(wert: string | undefined): string {
  if (!wert) return 'fehlt';
  if (wert.includes('bitte-ersetzen')) return 'noch der Entwicklungswert';
  if (wert.length < 32) return `zu kurz (${wert.length} Zeichen, nötig sind 32)`;
  return `gesetzt (${wert.length} Zeichen)`;
}
