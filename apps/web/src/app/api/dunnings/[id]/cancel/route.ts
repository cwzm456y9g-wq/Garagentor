import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { dunningService } from '@/server/dienste/invoices/dunning.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt<{ id: string }>(
  async (_anfrage, { params }) => {
    return json(await dunningService.cancel(params.id));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG],
);
