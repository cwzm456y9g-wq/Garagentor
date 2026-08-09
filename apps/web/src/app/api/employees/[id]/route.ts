import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { hrService } from '@/server/dienste/hr/hr.service';
import { updateEmployeeSchema } from '@/server/dienste/hr/dto/hr.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string };

export const GET = geschuetzt<Kennung>(
  async (_a, { params }) => json(await hrService.findOne(params.id)),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
);

export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) =>
    json(await hrService.update(params.id, await rumpf(anfrage, updateEmployeeSchema))),
  [Role.GESCHAEFTSFUEHRUNG],
);

export const DELETE = geschuetzt<Kennung>(
  async (_a, { params }) => json(await hrService.remove(params.id)),
  [Role.GESCHAEFTSFUEHRUNG],
);
