import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { quotesService } from '@/server/dienste/quotes/quotes.service';
import { updateQuoteSchema } from '@/server/dienste/quotes/dto/quote.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string };

export const GET = geschuetzt<Kennung>(async (_anfrage, { params }) => {
  return json(await quotesService.findOne(params.id));
});

export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) => {
    return json(await quotesService.update(params.id, await rumpf(anfrage, updateQuoteSchema)));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);

export const DELETE = geschuetzt<Kennung>(
  async (_anfrage, { params }) => {
    return json(await quotesService.remove(params.id));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
