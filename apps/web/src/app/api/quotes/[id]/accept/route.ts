import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { quotesService } from '@/server/dienste/quotes/quotes.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt<{ id: string }>(
  async (_anfrage, { params }) => {
    return json(await quotesService.accept(params.id));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
