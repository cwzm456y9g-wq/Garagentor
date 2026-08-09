import { Role } from '@prisma/client';
import { abfrage, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { quotesService } from '@/server/dienste/quotes/quotes.service';
import { createQuoteSchema, quoteQuerySchema } from '@/server/dienste/quotes/dto/quote.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) => {
  return json(await quotesService.findAll(abfrage(anfrage, quoteQuerySchema)));
});

export const POST = geschuetzt(
  async (anfrage) => {
    return json(await quotesService.create(await rumpf(anfrage, createQuoteSchema)), 201);
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
