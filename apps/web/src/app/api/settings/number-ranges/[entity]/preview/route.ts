import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { settingsService } from '@/server/dienste/settings/settings.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Zeigt die nächste Nummer, ohne den Zähler zu bewegen.
export const GET = geschuetzt<{ entity: string }>(
  async (_a, { params }) => json(await settingsService.previewNumber(params.entity)),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
