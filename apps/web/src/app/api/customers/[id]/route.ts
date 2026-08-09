import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { customers } from '@/server/dienste/customers/customers.service';
import { updateCustomerSchema } from '@/server/dienste/customers/dto/customer.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string };

export const GET = geschuetzt<Kennung>(async (_anfrage, { params }) => {
  return json(await customers.findOne(params.id));
});

export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) => {
    return json(await customers.update(params.id, await rumpf(anfrage, updateCustomerSchema)));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
);

export const DELETE = geschuetzt<Kennung>(
  async (_anfrage, { params }) => {
    return json(await customers.remove(params.id));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
