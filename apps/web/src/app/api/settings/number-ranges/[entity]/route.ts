import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { settingsService } from '@/server/dienste/settings/settings.service';
import { updateNumberRangeSchema } from '@/server/dienste/settings/dto/settings.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Nummernkreise ändert allein die Geschäftsführung: eine doppelt vergebene
// Belegnummer bricht die fortlaufende Nummerierung nach GoBD.
export const PATCH = geschuetzt<{ entity: string }>(
  async (anfrage, { params }) =>
    json(
      await settingsService.updateNumberRange(
        params.entity,
        await rumpf(anfrage, updateNumberRangeSchema),
      ),
    ),
  [Role.GESCHAEFTSFUEHRUNG],
);
