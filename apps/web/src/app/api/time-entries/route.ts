import { abfrage, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { timeEntriesService } from '@/server/dienste/planning/time-entries.service';
import {
  createTimeEntrySchema,
  timeEntryQuerySchema,
} from '@/server/dienste/planning/dto/planning.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Zeiten sind personenbezogen: der Dienst bekommt den angemeldeten Benutzer
// mit und beschränkt Monteure auf die eigenen Einträge.
export const GET = geschuetzt(async (anfrage, { benutzer }) =>
  json(await timeEntriesService.findAll(abfrage(anfrage, timeEntryQuerySchema), benutzer)),
);

export const POST = geschuetzt(async (anfrage, { benutzer }) =>
  json(await timeEntriesService.create(await rumpf(anfrage, createTimeEntrySchema), benutzer), 201),
);
