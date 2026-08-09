import { Role } from '@prisma/client';
import { abfrage, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { hrService } from '@/server/dienste/hr/hr.service';
import { createEmployeeSchema, employeeQuerySchema } from '@/server/dienste/hr/dto/hr.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) =>
  json(await hrService.findAll(abfrage(anfrage, employeeQuerySchema))),
);

// Personal anlegen und ändern bleibt allein der Geschäftsführung vorbehalten:
// an den Sätzen hängen Lohn und Nachkalkulation.
export const POST = geschuetzt(
  async (anfrage) => json(await hrService.create(await rumpf(anfrage, createEmployeeSchema)), 201),
  [Role.GESCHAEFTSFUEHRUNG],
);
