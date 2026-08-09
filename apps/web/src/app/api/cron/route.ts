import { offen } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { pruefeCronGeheimnis } from '@/server/cron-schutz';
import { abgelaufeneTokensEntfernen } from '@/server/dienste/anmeldedienst';
import { invoicesService } from '@/server/dienste/invoices/invoices.service';
import { quotesService } from '@/server/dienste/quotes/quotes.service';
import { serviceReportsService } from '@/server/dienste/doors/service-reports.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Die vier nächtlichen Läufe, in einem Aufruf.
 *
 * Früher waren es vier Zeitpläne im Prozess (1, 2, 3 und 4 Uhr). Auf
 * Hostingers Webhosting gibt es aber nur eine begrenzte Zahl an Cron-Einträgen,
 * und die Reihenfolge ist hier ohnehin egal – die Läufe hängen nicht
 * voneinander ab. Ein Eintrag genügt.
 *
 * Ein fehlgeschlagener Lauf hält die übrigen nicht auf: dass der Mahnlauf
 * klemmt, ist kein Grund, abgelaufene Angebote offen zu lassen.
 */
export const POST = offen(async (anfrage) => {
  pruefeCronGeheimnis(anfrage);

  const laeufe = [
    ['angeboteAbgelaufen', () => quotesService.expireOverdue()],
    ['rechnungenUeberfaellig', () => invoicesService.markOverdue()],
    ['tokensAufgeraeumt', () => abgelaufeneTokensEntfernen()],
    ['wartungsvertraegeAbgelaufen', () => serviceReportsService.expireContracts()],
  ] as const;

  const ergebnis: Record<string, number | string> = {};
  for (const [name, lauf] of laeufe) {
    try {
      ergebnis[name] = await lauf();
    } catch (fehler) {
      ergebnis[name] = `fehlgeschlagen: ${fehler instanceof Error ? fehler.message : fehler}`;
      console.error(`[Cron] ${name} fehlgeschlagen`, fehler);
    }
  }

  return json({ zeitpunkt: new Date().toISOString(), ...ergebnis });
});
