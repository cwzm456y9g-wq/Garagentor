import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { settingsService } from '@/server/dienste/settings/settings.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(
  async () => json(await settingsService.findNumberRanges()),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
