import { offen } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Wie lange auf die Datenbank gewartet wird, bevor die Antwort ohne sie
 * hinausgeht.
 *
 * Der Wert ist bewusst knapp. Diese Auskunft soll auch dann kommen, wenn die
 * Datenbank nicht antwortet – gerade dann ist sie ja interessant.
 */
const GEDULD_MS = 4000;

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
      // Nur die erste Zeile: Sie benennt die Ursache, ohne die
      // Verbindungszeichenfolge samt Passwort auszuplaudern.
      details: fehler instanceof Error ? fehler.message.split('\n')[0].slice(0, 200) : undefined,
    }));

  try {
    return await Promise.race([abfrage, zeitgrenze]);
  } finally {
    clearTimeout(zeitgeber);
  }
}

// Ohne Anmeldung erreichbar: Überwachung und Hostinger sollen die Anwendung
// prüfen können, ohne Zugangsdaten zu hinterlegen. Preisgegeben wird nichts
// außer der Erreichbarkeit.
export const GET = offen(async () => {
  const { befund, details } = await datenbankBefund();

  return json({
    status: befund === 'ok' ? 'ok' : 'eingeschränkt',
    database: befund,
    ...(details ? { detail: details } : {}),
    timestamp: new Date().toISOString(),
  });
});
