import { Role } from '@prisma/client';
import { RUMPF_GROSS, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { inspectionsService } from '@/server/dienste/doors/inspections.service';
import { recordChecksSchema } from '@/server/dienste/doors/dto/inspection.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = geschuetzt<{ id: string }>(
  async (anfrage, { params }) => {
    const eingabe = await rumpf(anfrage, recordChecksSchema, RUMPF_GROSS);
    return json(await inspectionsService.recordChecks(params.id, eingabe));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
);
