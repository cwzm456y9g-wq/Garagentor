import { Role } from '@prisma/client';
import { abfrage, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { purchasingService } from '@/server/dienste/inventory/purchasing.service';
import {
  createPurchaseOrderSchema,
  purchaseOrderQuerySchema,
} from '@/server/dienste/inventory/dto/inventory.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) => {
  return json(await purchasingService.findOrders(abfrage(anfrage, purchaseOrderQuerySchema)));
});

export const POST = geschuetzt(
  async (anfrage) => {
    return json(
      await purchasingService.createOrder(await rumpf(anfrage, createPurchaseOrderSchema)),
      201,
    );
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
