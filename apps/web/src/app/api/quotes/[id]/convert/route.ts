import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { quotesService } from '@/server/dienste/quotes/quotes.service';
import { convertQuoteSchema } from '@/server/dienste/quotes/dto/quote.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt<{ id: string }>(
  async (anfrage, { params }) => {
    return json(
      await quotesService.convertToOrder(params.id, await rumpf(anfrage, convertQuoteSchema)),
      201,
    );
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
