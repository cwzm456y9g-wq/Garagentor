import { Role } from '@prisma/client';
import { abfrage, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { ordersService } from '@/server/dienste/orders/orders.service';
import { createOrderSchema, orderQuerySchema } from '@/server/dienste/orders/dto/order.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) => {
  return json(await ordersService.findAll(abfrage(anfrage, orderQuerySchema)));
});

export const POST = geschuetzt(
  async (anfrage) => {
    return json(await ordersService.create(await rumpf(anfrage, createOrderSchema)), 201);
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
