import { z } from 'zod';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { timeEntriesService } from '@/server/dienste/planning/time-entries.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  employeeId: z.string(),
  from: z.string().refine((wert) => !Number.isNaN(Date.parse(wert)), {
    message: 'Bitte ein gültiges Datum angeben.',
  }),
});

export const GET = geschuetzt(async (anfrage, { benutzer }) => {
  const { employeeId, from } = abfrage(anfrage, schema);
  return json(await timeEntriesService.weekSummary(employeeId, from, benutzer));
});
