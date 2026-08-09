import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { invoicesService } from '@/server/dienste/invoices/invoices.service';
import { updateInvoiceSchema } from '@/server/dienste/invoices/dto/invoice.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string };

export const GET = geschuetzt<Kennung>(async (_anfrage, { params }) => {
  return json(await invoicesService.findOne(params.id));
});

export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) => {
    return json(await invoicesService.update(params.id, await rumpf(anfrage, updateInvoiceSchema)));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
);
