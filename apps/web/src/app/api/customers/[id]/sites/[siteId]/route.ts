import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { customers } from '@/server/dienste/customers/customers.service';
import { updateSiteSchema } from '@/server/dienste/customers/dto/customer.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string; siteId: string };

export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) => {
    return json(
      await customers.updateSite(params.id, params.siteId, await rumpf(anfrage, updateSiteSchema)),
    );
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);

export const DELETE = geschuetzt<Kennung>(
  async (_anfrage, { params }) => {
    return json(await customers.removeSite(params.id, params.siteId));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
