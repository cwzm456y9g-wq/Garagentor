import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { projectsService } from '@/server/dienste/planning/projects.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Die Projektauswertung stellt Budget und Kosten gegenüber.
export const GET = geschuetzt<{ id: string }>(
  async (_a, { params }) => json(await projectsService.summary(params.id)),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
);
