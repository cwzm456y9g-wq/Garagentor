import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { inspectionsService } from '@/server/dienste/doors/inspections.service';
import { updateDefectStatusSchema } from '@/server/dienste/doors/dto/inspection.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = geschuetzt<{ id: string }>(
  async (anfrage, { params }) => {
    const eingabe = await rumpf(anfrage, updateDefectStatusSchema);
    return json(await inspectionsService.updateDefectStatus(params.id, eingabe.status));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
);
