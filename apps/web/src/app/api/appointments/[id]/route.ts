import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { appointmentsService } from '@/server/dienste/planning/appointments.service';
import { updateAppointmentSchema } from '@/server/dienste/planning/dto/planning.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string };

export const GET = geschuetzt<Kennung>(async (_a, { params }) =>
  json(await appointmentsService.findOne(params.id)),
);

// Der Monteur darf einen Termin ändern, weil er unterwegs meldet, dass er
// angekommen oder fertig ist – Termine anlegen und löschen darf er nicht.
export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) =>
    json(
      await appointmentsService.update(params.id, await rumpf(anfrage, updateAppointmentSchema)),
    ),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
);

export const DELETE = geschuetzt<Kennung>(
  async (_a, { params }) => json(await appointmentsService.remove(params.id)),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
