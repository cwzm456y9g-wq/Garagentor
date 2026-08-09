import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { inspectionsService } from '@/server/dienste/doors/inspections.service';
import { resolveDefectSchema } from '@/server/dienste/doors/dto/inspection.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt<{ id: string }>(
  async (anfrage, { params }) => {
    return json(
      await inspectionsService.resolveDefect(params.id, await rumpf(anfrage, resolveDefectSchema)),
    );
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
);
