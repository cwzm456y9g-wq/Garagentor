import { Role } from '@prisma/client';
import { z } from 'zod';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { hrService } from '@/server/dienste/hr/hr.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ withinDays: z.coerce.number().int().min(0).max(3650).optional() });

// Läuft die Sachkunde ab, darf die Person keine Prüfung mehr unterschreiben.
export const GET = geschuetzt(
  async (anfrage) => {
    const { withinDays } = abfrage(anfrage, schema);
    return json(await hrService.expiringQualifications(withinDays));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
