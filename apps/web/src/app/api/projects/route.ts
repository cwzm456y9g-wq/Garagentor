import { Role } from '@prisma/client';
import { abfrage, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { projectsService } from '@/server/dienste/planning/projects.service';
import {
  createProjectSchema,
  projectQuerySchema,
} from '@/server/dienste/planning/dto/planning.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) =>
  json(await projectsService.findAll(abfrage(anfrage, projectQuerySchema))),
);

export const POST = geschuetzt(
  async (anfrage) =>
    json(await projectsService.create(await rumpf(anfrage, createProjectSchema)), 201),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
