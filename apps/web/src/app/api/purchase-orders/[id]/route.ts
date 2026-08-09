import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { purchasingService } from '@/server/dienste/inventory/purchasing.service';
import { updatePurchaseOrderSchema } from '@/server/dienste/inventory/dto/inventory.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string };

export const GET = geschuetzt<Kennung>(async (_a, { params }) =>
  json(await purchasingService.findOrder(params.id)),
);

export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) => {
    return json(
      await purchasingService.updateOrder(
        params.id,
        await rumpf(anfrage, updatePurchaseOrderSchema),
      ),
    );
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);

export const DELETE = geschuetzt<Kennung>(
  async (_a, { params }) => json(await purchasingService.removeOrder(params.id)),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
