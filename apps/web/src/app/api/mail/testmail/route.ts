import { Role } from '@prisma/client';
import { z } from 'zod';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { mailService } from '@/server/dienste/mail/mail.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const testmailSchema = z.object({ an: z.string().max(200) }).strict();

/**
 * Verschickt eine Testmail an eine frei wählbare Adresse.
 *
 * Nur für die Geschäftsführung: Der Endpunkt versendet unter der Adresse des
 * Betriebs. Wer ihn aufrufen kann, kann in dessen Namen schreiben.
 */
export const POST = geschuetzt(
  async (anfrage) => {
    const { an } = await rumpf(anfrage, testmailSchema);
    return json(await mailService.testmail(an.trim()));
  },
  [Role.GESCHAEFTSFUEHRUNG],
);
