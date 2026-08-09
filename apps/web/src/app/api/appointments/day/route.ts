import { z } from 'zod';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { appointmentsService } from '@/server/dienste/planning/appointments.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  date: z.string().refine((wert) => !Number.isNaN(Date.parse(wert)), {
    message: 'Bitte ein gültiges Datum angeben.',
  }),
  employeeId: z.string().optional(),
});

export const GET = geschuetzt(async (anfrage) => {
  const { date, employeeId } = abfrage(anfrage, schema);
  return json(await appointmentsService.daySchedule(date, employeeId));
});
