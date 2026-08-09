import { z } from 'zod';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { settingsService } from '@/server/dienste/settings/settings.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ category: z.string().optional() });

export const GET = geschuetzt(async (anfrage) =>
  json(await settingsService.findAll(abfrage(anfrage, schema).category)),
);
