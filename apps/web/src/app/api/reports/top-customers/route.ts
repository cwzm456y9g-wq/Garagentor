import { Role } from '@prisma/client';
import { z } from 'zod';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { reportsService } from '@/server/dienste/reports/reports.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const datum = z.string().refine((wert) => !Number.isNaN(Date.parse(wert)), {
  message: 'Bitte ein gültiges Datum angeben.',
});

const schema = z.object({
  from: datum.optional(),
  to: datum.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = geschuetzt(
  async (anfrage) => {
    const { from, to, limit } = abfrage(anfrage, schema);
    return json(await reportsService.topCustomers(from, to, limit));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
);
