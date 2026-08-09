import { Role } from '@prisma/client';
import { abfrage, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { customers } from '@/server/dienste/customers/customers.service';
import {
  createCustomerSchema,
  kundenAbfrageSchema,
} from '@/server/dienste/customers/dto/customer.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) => {
  return json(await customers.findAll(abfrage(anfrage, kundenAbfrageSchema)));
});

export const POST = geschuetzt(
  async (anfrage) => {
    return json(await customers.create(await rumpf(anfrage, createCustomerSchema)), 201);
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
);
