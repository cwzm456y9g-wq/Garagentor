import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { customers } from '@/server/dienste/customers/customers.service';
import { updateAddressSchema } from '@/server/dienste/customers/dto/customer.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string; addressId: string };

export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) => {
    return json(
      await customers.updateAddress(
        params.id,
        params.addressId,
        await rumpf(anfrage, updateAddressSchema),
      ),
    );
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
);

export const DELETE = geschuetzt<Kennung>(
  async (_anfrage, { params }) => {
    return json(await customers.removeAddress(params.id, params.addressId));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
