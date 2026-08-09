import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { invoicesService } from '@/server/dienste/invoices/invoices.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt<{ id: string }>(
  async (_anfrage, { params }) => {
    return json(await invoicesService.send(params.id));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
);
