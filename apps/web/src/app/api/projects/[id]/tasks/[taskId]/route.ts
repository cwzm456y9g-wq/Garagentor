import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { projectsService } from '@/server/dienste/planning/projects.service';
import { updateProjectTaskSchema } from '@/server/dienste/planning/dto/planning.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string; taskId: string };

// Der Monteur darf eine Aufgabe auf erledigt setzen, aber keine anlegen.
export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) =>
    json(
      await projectsService.updateTask(
        params.id,
        params.taskId,
        await rumpf(anfrage, updateProjectTaskSchema),
      ),
    ),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
);

export const DELETE = geschuetzt<Kennung>(
  async (_a, { params }) => json(await projectsService.removeTask(params.id, params.taskId)),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
