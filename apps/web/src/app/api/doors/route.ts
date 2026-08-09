import { Role } from '@prisma/client';
import { abfrage, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { doors } from '@/server/dienste/doors/doors.service';
import { createDoorSchema, doorQuerySchema } from '@/server/dienste/doors/dto/door.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) => {
  return json(await doors.findAll(abfrage(anfrage, doorQuerySchema)));
});

// Der Monteur darf Anlagen anlegen und pflegen: er steht davor und liest die
// Typenschilder ab.
export const POST = geschuetzt(
  async (anfrage) => {
    return json(await doors.create(await rumpf(anfrage, createDoorSchema)), 201);
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
);
