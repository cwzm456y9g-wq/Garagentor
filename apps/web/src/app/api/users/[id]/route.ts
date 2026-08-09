import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { usersService } from '@/server/dienste/auth/users.service';
import { benutzerAendernSchema } from '@/server/schemata/anmeldung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string };

export const GET = geschuetzt<Kennung>(
  async (_a, { params }) => json(await usersService.findOne(params.id)),
  [Role.ADMIN, Role.GESCHAEFTSFUEHRUNG],
);

// Der handelnde Benutzer wird mitgegeben, damit der Dienst verhindern kann,
// dass jemand sich selbst die Rolle entzieht oder das eigene Konto abschaltet.
export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params, benutzer }) =>
    json(
      await usersService.update(
        params.id,
        await rumpf(anfrage, benutzerAendernSchema),
        benutzer.id,
      ),
    ),
  [Role.ADMIN],
);

export const DELETE = geschuetzt<Kennung>(
  async (_a, { params, benutzer }) => json(await usersService.deactivate(params.id, benutzer.id)),
  [Role.ADMIN],
);
