import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { projectsService } from '@/server/dienste/planning/projects.service';
import { updateProjectSchema } from '@/server/dienste/planning/dto/planning.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string };

export const GET = geschuetzt<Kennung>(async (_a, { params }) =>
  json(await projectsService.findOne(params.id)),
);

export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) =>
    json(await projectsService.update(params.id, await rumpf(anfrage, updateProjectSchema))),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);

export const DELETE = geschuetzt<Kennung>(
  async (_a, { params }) => json(await projectsService.remove(params.id)),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
