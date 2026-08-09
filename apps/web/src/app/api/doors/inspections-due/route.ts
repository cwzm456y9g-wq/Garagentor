import { z } from 'zod';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { doors } from '@/server/dienste/doors/doors.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ withinDays: z.coerce.number().int().min(0).max(3650).optional() });

export const GET = geschuetzt(async (anfrage) => {
  const { withinDays } = abfrage(anfrage, schema);
  return json(await doors.inspectionsDue(withinDays));
});
