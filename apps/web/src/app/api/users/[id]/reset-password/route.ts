import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { usersService } from '@/server/dienste/auth/users.service';
import { passwortZuruecksetzenSchema } from '@/server/schemata/anmeldung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Setzt das Passwort neu und beendet alle Sitzungen des Kontos.
export const POST = geschuetzt<{ id: string }>(
  async (anfrage, { params }) => {
    const eingabe = await rumpf(anfrage, passwortZuruecksetzenSchema);
    return json(await usersService.resetPassword(params.id, eingabe.newPassword));
  },
  [Role.ADMIN],
);
