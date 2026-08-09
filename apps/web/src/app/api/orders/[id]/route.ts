import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { ordersService } from '@/server/dienste/orders/orders.service';
import { updateOrderSchema } from '@/server/dienste/orders/dto/order.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string };

export const GET = geschuetzt<Kennung>(async (_anfrage, { params }) => {
  return json(await ordersService.findOne(params.id));
});

export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) => {
    return json(await ordersService.update(params.id, await rumpf(anfrage, updateOrderSchema)));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);

export const DELETE = geschuetzt<Kennung>(
  async (_anfrage, { params }) => {
    return json(await ordersService.remove(params.id));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
