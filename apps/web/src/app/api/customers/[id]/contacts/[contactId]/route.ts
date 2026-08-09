import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { customers } from '@/server/dienste/customers/customers.service';
import { updateContactSchema } from '@/server/dienste/customers/dto/customer.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string; contactId: string };

export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) => {
    return json(
      await customers.updateContact(
        params.id,
        params.contactId,
        await rumpf(anfrage, updateContactSchema),
      ),
    );
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
);

export const DELETE = geschuetzt<Kennung>(
  async (_anfrage, { params }) => {
    return json(await customers.removeContact(params.id, params.contactId));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
