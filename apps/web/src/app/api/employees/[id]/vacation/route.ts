import { Role } from '@prisma/client';
import { z } from 'zod';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { hrService } from '@/server/dienste/hr/hr.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ year: z.coerce.number().int().min(2000).max(2200).optional() });

export const GET = geschuetzt<{ id: string }>(
  async (anfrage, { params }) => {
    const { year } = abfrage(anfrage, schema);
    return json(await hrService.vacationBalance(params.id, year ?? new Date().getFullYear()));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
