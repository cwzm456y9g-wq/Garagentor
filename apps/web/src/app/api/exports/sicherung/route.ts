import { Role } from '@prisma/client';
import { z } from 'zod';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { datei } from '@/server/antwort';
import { sicherung } from '@/server/dienste/exports/sicherung.service';

// Das Archiv entsteht im Node-Prozess; auf Edge gäbe es weder zlib noch Prisma.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sicherungQuerySchema = z.object({
  /** Hochgeladene Dateien mitpacken. */
  dokumente: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((wert) => wert === 'true'),
});

/**
 * Die vollständige Sicherung zum Herunterladen.
 *
 * Nur für die Geschäftsführung: In dieser einen Datei steht der gesamte
 * Kundenstamm samt Personaldaten. Wer die Anwendung bedient, braucht das nicht;
 * wer den Betrieb führt, muß es bekommen können, ohne jemanden zu fragen.
 */
export const GET = geschuetzt(
  async (anfrage) => {
    const { dokumente } = abfrage(anfrage, sicherungQuerySchema);
    const { inhalt, dateiname } = await sicherung.archiv(dokumente);

    return datei(inhalt, { typ: 'application/zip', name: dateiname });
  },
  [Role.GESCHAEFTSFUEHRUNG],
);
