import { abfrage, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { hrService } from '@/server/dienste/hr/hr.service';
import { absenceQuerySchema, createAbsenceSchema } from '@/server/dienste/hr/dto/hr.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Abwesenheiten sind personenbezogen: jeder darf seinen eigenen Urlaub
// beantragen und sehen, fremde nur mit entsprechender Rolle.
export const GET = geschuetzt(async (anfrage, { benutzer }) =>
  json(await hrService.findAbsences(abfrage(anfrage, absenceQuerySchema), benutzer)),
);

export const POST = geschuetzt(async (anfrage, { benutzer }) =>
  json(await hrService.createAbsence(await rumpf(anfrage, createAbsenceSchema), benutzer), 201),
);
