import { Role } from '@prisma/client';
import { abfrage, paginationSchema, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { purchasingService } from '@/server/dienste/inventory/purchasing.service';
import { createSupplierSchema } from '@/server/dienste/inventory/dto/inventory.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) => {
  return json(await purchasingService.findSuppliers(abfrage(anfrage, paginationSchema)));
});

export const POST = geschuetzt(
  async (anfrage) => {
    return json(
      await purchasingService.createSupplier(await rumpf(anfrage, createSupplierSchema)),
      201,
    );
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
