import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { projectsService } from '@/server/dienste/planning/projects.service';
import { createProjectTaskSchema } from '@/server/dienste/planning/dto/planning.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt<{ id: string }>(
  async (anfrage, { params }) =>
    json(
      await projectsService.addTask(params.id, await rumpf(anfrage, createProjectTaskSchema)),
      201,
    ),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
