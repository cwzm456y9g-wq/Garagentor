import { Role } from '@prisma/client';
import { abfrage, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { appointmentsService } from '@/server/dienste/planning/appointments.service';
import {
  appointmentQuerySchema,
  createAppointmentSchema,
} from '@/server/dienste/planning/dto/planning.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) =>
  json(await appointmentsService.findAll(abfrage(anfrage, appointmentQuerySchema))),
);

export const POST = geschuetzt(
  async (anfrage) =>
    json(await appointmentsService.create(await rumpf(anfrage, createAppointmentSchema)), 201),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
