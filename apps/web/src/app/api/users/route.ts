import { Role } from '@prisma/client';
import { abfrage, paginationSchema, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { usersService } from '@/server/dienste/auth/users.service';
import { benutzerAnlegenSchema } from '@/server/schemata/anmeldung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(
  async (anfrage) => json(await usersService.findAll(abfrage(anfrage, paginationSchema))),
  [Role.ADMIN, Role.GESCHAEFTSFUEHRUNG],
);

// Konten anlegen darf allein die Verwaltung: daran hängt, wer überhaupt in die
// Anwendung kommt.
export const POST = geschuetzt(
  async (anfrage) =>
    json(await usersService.create(await rumpf(anfrage, benutzerAnlegenSchema)), 201),
  [Role.ADMIN],
);
