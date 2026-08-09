import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { hrService } from '@/server/dienste/hr/hr.service';
import { decideAbsenceSchema } from '@/server/dienste/hr/dto/hr.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Über den eigenen Urlaub entscheidet niemand selbst – das prüft der Dienst.
export const POST = geschuetzt<{ id: string }>(
  async (anfrage, { params, benutzer }) =>
    json(
      await hrService.decideAbsence(params.id, await rumpf(anfrage, decideAbsenceSchema), benutzer),
    ),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
