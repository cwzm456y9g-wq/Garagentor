import { z } from 'zod';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { reportsService } from '@/server/dienste/reports/reports.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ year: z.coerce.number().int().min(2000).max(2200).optional() });

export const GET = geschuetzt(async (anfrage) =>
  json(await reportsService.inspectionStatistics(abfrage(anfrage, schema).year)),
);
