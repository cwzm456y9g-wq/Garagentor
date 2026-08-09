import { z } from 'zod';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { searchService } from '@/server/dienste/search/search.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  q: z.string(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = geschuetzt(async (anfrage) => {
  const { q, limit } = abfrage(anfrage, schema);
  return json(await searchService.search(q, limit));
});
