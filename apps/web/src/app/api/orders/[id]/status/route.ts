import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { ordersService } from '@/server/dienste/orders/orders.service';
import { updateOrderStatusSchema } from '@/server/dienste/orders/dto/order.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Der Monteur darf den Status setzen – er meldet vor Ort, dass die Arbeit
// begonnen oder abgeschlossen ist –, aber sonst nichts am Auftrag ändern.
export const PATCH = geschuetzt<{ id: string }>(
  async (anfrage, { params }) => {
    const eingabe = await rumpf(anfrage, updateOrderStatusSchema);
    return json(await ordersService.changeStatus(params.id, eingabe.status));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
);
