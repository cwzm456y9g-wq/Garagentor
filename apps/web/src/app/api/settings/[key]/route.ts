import { Role } from '@prisma/client';
import { RUMPF_GROSS, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { settingsService } from '@/server/dienste/settings/settings.service';
import { upsertSettingSchema } from '@/server/dienste/settings/dto/settings.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { key: string };

export const GET = geschuetzt<Kennung>(async (_a, { params }) =>
  json(await settingsService.findOne(params.key)),
);

// Eine Einstellung ganz zu entfernen ist ein Eingriff in die Grundlagen der
// Anwendung und bleibt der Verwaltung vorbehalten.
export const DELETE = geschuetzt<Kennung>(
  async (_a, { params }) => json(await settingsService.remove(params.key)),
  [Role.ADMIN],
);

// Größerer Rumpf: die Firmendaten tragen das Logo als Data-URL.
export const PUT = geschuetzt<Kennung>(
  async (anfrage, { params }) =>
    json(
      await settingsService.upsert(
        params.key,
        await rumpf(anfrage, upsertSettingSchema, RUMPF_GROSS),
      ),
    ),
  [Role.GESCHAEFTSFUEHRUNG],
);
