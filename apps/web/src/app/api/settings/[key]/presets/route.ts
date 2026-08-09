import { Role } from '@prisma/client';
import { RUMPF_GROSS, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { settingsService } from '@/server/dienste/settings/settings.service';
import { savePresetSchema } from '@/server/dienste/settings/dto/settings.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { key: string };

export const GET = geschuetzt<Kennung>(async (_a, { params }) =>
  json(await settingsService.findPresets(params.key)),
);

export const POST = geschuetzt<Kennung>(
  async (anfrage, { params }) =>
    json(
      await settingsService.savePreset(
        params.key,
        await rumpf(anfrage, savePresetSchema, RUMPF_GROSS),
      ),
      201,
    ),
  [Role.GESCHAEFTSFUEHRUNG],
);
