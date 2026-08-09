import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { settingsService } from '@/server/dienste/settings/settings.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = geschuetzt<{ key: string; id: string }>(
  async (_a, { params }) => json(await settingsService.removePreset(params.key, params.id)),
  [Role.GESCHAEFTSFUEHRUNG],
);
