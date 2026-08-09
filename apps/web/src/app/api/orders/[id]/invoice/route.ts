import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { ordersService } from '@/server/dienste/orders/orders.service';
import { createInvoiceFromOrderSchema } from '@/server/dienste/orders/dto/order.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt<{ id: string }>(
  async (anfrage, { params }) => {
    return json(
      await ordersService.createInvoice(
        params.id,
        await rumpf(anfrage, createInvoiceFromOrderSchema),
      ),
      201,
    );
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
);
