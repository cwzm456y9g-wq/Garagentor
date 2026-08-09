import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { timeEntriesService } from '@/server/dienste/planning/time-entries.service';
import { updateTimeEntrySchema } from '@/server/dienste/planning/dto/planning.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string };

export const GET = geschuetzt<Kennung>(async (_a, { params, benutzer }) =>
  json(await timeEntriesService.findOne(params.id, benutzer)),
);

export const PATCH = geschuetzt<Kennung>(async (anfrage, { params, benutzer }) =>
  json(
    await timeEntriesService.update(
      params.id,
      await rumpf(anfrage, updateTimeEntrySchema),
      benutzer,
    ),
  ),
);

export const DELETE = geschuetzt<Kennung>(async (_a, { params, benutzer }) =>
  json(await timeEntriesService.remove(params.id, benutzer)),
);
