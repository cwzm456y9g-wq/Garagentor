import { offen } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { prisma } from '@/server/prisma';
import { untersuche } from '@/server/db-adresse';
import { netzpruefung } from '@/server/netzpruefung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Wie lange auf die Datenbank gewartet wird, bevor die Antwort ohne sie
 * hinausgeht.
 *
 * Der Wert liegt bewusst **knapp über** der Zeitgrenze des Verbindungsaufbaus
 * (zehn Sekunden, siehe `server/prisma.ts`). Anfangs stand hier ein knapperes
 * Maß, und das kostete eine Runde: Eine abgelehnte Verbindung brauchte länger
 * als die Geduld hier, und die Auskunft meldete „Zeitüberschreitung", wo die
 * Datenbank in Wahrheit eine benennbare Absage geschickt hatte. Wer zuerst
 * aufgibt, bestimmt die Meldung – also darf es nicht diese Stelle sein.
 *
 * Bis zur Grenze des Webservers (üblicherweise sechzig Sekunden) bleibt reichlich
 * Abstand.
 */
const GEDULD_MS = 12_000;

type Befund = 'ok' | 'nicht erreichbar' | 'Zeitüberschreitung';

/**
 * Fragt die Datenbank, gibt aber spätestens nach `GEDULD_MS` auf.
 *
 * Der Unterschied zwischen den beiden Fehlerfällen ist der eigentliche Zweck:
 *
 *   „nicht erreichbar"    Die Datenbank hat geantwortet – ablehnend. Falsches
 *                         Passwort, falscher Benutzer, gesperrtes Konto.
 *   „Zeitüberschreitung"  Es kam gar nichts zurück. So verhält sich ein
 *                         blockierter Port: Die Pakete verschwinden, niemand
 *                         schickt eine Absage.
 *
 * Ohne diese Unterscheidung lief die Anfrage einfach in die Zeitgrenze des
 * Webservers und wurde zu einem 504 – einer Meldung, die über die Ursache
 * nichts aussagt und obendrein die Überwachung veranlasst, den Prozess für
 * hängend zu halten und neu zu starten.
 */
async function datenbankBefund(): Promise<{ befund: Befund; details?: string }> {
  let zeitgeber: NodeJS.Timeout | undefined;

  const zeitgrenze = new Promise<{ befund: Befund }>((erfuellen) => {
    zeitgeber = setTimeout(() => erfuellen({ befund: 'Zeitüberschreitung' }), GEDULD_MS);
  });

  const abfrage = prisma.$queryRaw`SELECT 1`
    .then(() => ({ befund: 'ok' as Befund }))
    .catch((fehler: unknown) => ({
      befund: 'nicht erreichbar' as Befund,
      details: ursache(fehler),
    }));

  try {
    return await Promise.race([abfrage, zeitgrenze]);
  } finally {
    clearTimeout(zeitgeber);
  }
}

/**
 * Die Ursache in einem Satz – ohne die Verbindungszeichenfolge samt Passwort
 * auszuplaudern.
 *
 * Hier stand einmal „die erste Zeile". Das ging schief, weil Prisma seine
 * Meldungen mit einer Leerzeile beginnt: Übrig blieb ein leeres Feld, und die
 * Auskunft sagte „nicht erreichbar" ohne zu sagen, warum – während in der
 * verworfenen Meldung „password authentication failed" stand. Deshalb die
 * erste Zeile, die überhaupt etwas enthält.
 */
function ursache(fehler: unknown): string | undefined {
  if (!(fehler instanceof Error)) return undefined;

  const zeilen = fehler.message
    .split('\n')
    .map((zeile) => zeile.trim())
    .filter(Boolean);

  // Prismas Meldungen führen mit dem Aufruf ein („Invalid `prisma.$queryRaw()`
  // invocation"); der eigentliche Grund steht dahinter. Steht er da, gewinnt er.
  const grund = zeilen.find((zeile) =>
    /Message:|failed|denied|timeout|ECONN|ENOTFOUND/i.test(zeile),
  );

  return (grund ?? zeilen[0])?.slice(0, 200);
}

/**
 * Wohin die Anwendung zu sprechen versucht – Rechnername und Port, sonst
 * nichts.
 *
 * Diese Angabe erscheint **nur, wenn die Datenbank nicht antwortet**. Im
 * Normalbetrieb steht sie nicht da, und selbst dann fehlen Benutzer, Passwort
 * und Datenbankname.
 *
 * Der Grund für die Ausnahme: Die ausführliche Diagnose ist mit CRON_SECRET
 * geschützt, und wer gerade eine Störung sucht, hat den Schlüssel oft nicht
 * zur Hand. Der häufigste Fehler an dieser Stelle lässt sich aber allein am
 * Rechnernamen erkennen – die Direktverbindung `db.<kennung>.supabase.co` ist
 * nur über IPv6 erreichbar, geteiltes Webhosting kommt dort nicht hin, und die
 * Verbindung läuft ohne jede Fehlermeldung ins Leere. Diese eine Zeile
 * unterscheidet das von einem falschen Passwort.
 */
async function stoerungsbild(): Promise<Record<string, unknown>> {
  const adresse = untersuche(process.env.DATABASE_URL);
  if ('fehler' in adresse) return { ziel: adresse.fehler };

  const bild: Record<string, unknown> = { ziel: `${adresse.rechner}:${adresse.port}` };

  // Die Hinweise sind allgemeine Sätze, keine Werte – etwa dass beim
  // Supabase-Pooler die Projektkennung zum Benutzernamen gehört. Genau solche
  // Kleinigkeiten erzeugen eine Verbindung, die niemals zustande kommt.
  if (adresse.auffaelligkeiten.length > 0) bild.hinweise = adresse.auffaelligkeiten;

  // Und die Frage, die sonst offenbleibt: Liegt es am Netz oder an dem, was
  // dahinter steht? Eine Abfrage ohne Antwort sieht in beiden Fällen gleich
  // aus. Ein Anklopfen am Port trennt die Fälle in wenigen Millisekunden.
  const port = Number.parseInt(adresse.port, 10);
  if (Number.isFinite(port)) bild.netz = await netzpruefung(adresse.rechner, port);

  return bild;
}

// Ohne Anmeldung erreichbar: Überwachung und Hostinger sollen die Anwendung
// prüfen können, ohne Zugangsdaten zu hinterlegen. Preisgegeben wird nichts
// außer der Erreichbarkeit – und im Störungsfall der Rechnername, den die
// Anwendung anzusprechen versucht.
export const GET = offen(async () => {
  const { befund, details } = await datenbankBefund();

  return json({
    status: befund === 'ok' ? 'ok' : 'eingeschränkt',
    database: befund,
    ...(details ? { detail: details } : {}),
    ...(befund === 'ok' ? {} : await stoerungsbild()),
    // Welcher Bau gerade läuft. Beim Ausrollen bleibt sonst offen, ob die
    // Änderung überhaupt angekommen ist – eine Frage, die schon mehrere Runden
    // gekostet hat, in denen an einem längst behobenen Fehler weitergesucht
    // wurde. Der Wert wird beim Bau des Ausrollzweigs eingesetzt.
    stand: process.env.GARAGENTOR_STAND ?? 'unbekannt (kein Ausrollpaket)',
    timestamp: new Date().toISOString(),
  });
});
