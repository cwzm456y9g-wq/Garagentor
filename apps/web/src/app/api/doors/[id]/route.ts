import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { doors } from '@/server/dienste/doors/doors.service';
import { updateDoorSchema } from '@/server/dienste/doors/dto/door.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string };

export const GET = geschuetzt<Kennung>(async (_anfrage, { params }) => {
  return json(await doors.findOne(params.id));
});

export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) => {
    return json(await doors.update(params.id, await rumpf(anfrage, updateDoorSchema)));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
);

export const DELETE = geschuetzt<Kennung>(
  async (_anfrage, { params }) => {
    return json(await doors.remove(params.id));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
