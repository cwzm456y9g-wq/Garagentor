import { Role } from '@prisma/client';
import { z } from 'zod';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { zuruecksetzen } from '@/server/dienste/settings/zuruecksetzen.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const zuruecksetzenSchema = z
  .object({
    /** Das abgetippte Bestätigungswort. */
    bestaetigung: z.string().min(1),
    /** Belegnummern wieder bei 1 beginnen lassen. */
    nummernkreise: z.boolean().default(true),
  })
  .strict();

/**
 * Zeigt, was ein Zurücksetzen anfassen würde – ohne etwas anzufassen.
 *
 * Diese Vorschau ist kein Beiwerk: Wer die Zahlen vorher sieht, merkt vor dem
 * Klick, wenn er in der falschen Anlage steht.
 */
export const GET = geschuetzt(async () => json(await zuruecksetzen.vorschau()), [
  Role.GESCHAEFTSFUEHRUNG,
]);

/**
 * Setzt die Betriebsdaten zurück.
 *
 * Nur für die Geschäftsführung, und nur mit dem abgetippten Bestätigungswort.
 * Beides zusammen: Die Rolle verhindert, daß es jemand kann, der es nicht
 * darf; das Wort verhindert, daß es jemand tut, der es nicht wollte.
 */
export const POST = geschuetzt(
  async (anfrage) => json(await zuruecksetzen.ausfuehren(await rumpf(anfrage, zuruecksetzenSchema))),
  [Role.GESCHAEFTSFUEHRUNG],
);
