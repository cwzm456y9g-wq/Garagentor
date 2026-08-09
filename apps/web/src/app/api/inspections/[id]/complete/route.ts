import { Role } from '@prisma/client';
import { RUMPF_GROSS, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { inspectionsService } from '@/server/dienste/doors/inspections.service';
import { completeInspectionSchema } from '@/server/dienste/doors/dto/inspection.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Größerer Rumpf: hier kommen zwei Unterschriften als Data-URL mit.
export const POST = geschuetzt<{ id: string }>(
  async (anfrage, { params }) => {
    const eingabe = await rumpf(anfrage, completeInspectionSchema, RUMPF_GROSS);
    return json(await inspectionsService.complete(params.id, eingabe));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
);
