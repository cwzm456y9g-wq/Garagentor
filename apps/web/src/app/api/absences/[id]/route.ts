import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { hrService } from '@/server/dienste/hr/hr.service';
import { updateAbsenceSchema } from '@/server/dienste/hr/dto/hr.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = geschuetzt<{ id: string }>(async (anfrage, { params, benutzer }) =>
  json(
    await hrService.updateAbsence(params.id, await rumpf(anfrage, updateAbsenceSchema), benutzer),
  ),
);
