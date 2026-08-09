import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { invoicesService } from '@/server/dienste/invoices/invoices.service';
import { createPaymentSchema } from '@/server/dienste/invoices/dto/invoice.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt<{ id: string }>(
  async (anfrage, { params }) => {
    return json(
      await invoicesService.addPayment(params.id, await rumpf(anfrage, createPaymentSchema)),
      201,
    );
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
);
