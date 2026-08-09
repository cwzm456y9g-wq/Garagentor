import { Role } from '@prisma/client';
import { abfrage, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { invoicesService } from '@/server/dienste/invoices/invoices.service';
import { createInvoiceSchema, invoiceQuerySchema } from '@/server/dienste/invoices/dto/invoice.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) => {
  return json(await invoicesService.findAll(abfrage(anfrage, invoiceQuerySchema)));
});

export const POST = geschuetzt(
  async (anfrage) => {
    return json(await invoicesService.create(await rumpf(anfrage, createInvoiceSchema)), 201);
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
);
