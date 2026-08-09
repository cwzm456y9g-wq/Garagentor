import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { purchasingService } from '@/server/dienste/inventory/purchasing.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt<{ id: string }>(
  async (_a, { params }) => json(await purchasingService.cancelOrder(params.id)),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
