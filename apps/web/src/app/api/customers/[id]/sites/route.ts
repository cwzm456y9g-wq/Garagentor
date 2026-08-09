import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { customers } from '@/server/dienste/customers/customers.service';
import { createSiteSchema } from '@/server/dienste/customers/dto/customer.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt<{ id: string }>(
  async (anfrage, { params }) => {
    return json(await customers.addSite(params.id, await rumpf(anfrage, createSiteSchema)), 201);
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
