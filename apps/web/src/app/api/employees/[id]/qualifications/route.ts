import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { hrService } from '@/server/dienste/hr/hr.service';
import { createQualificationSchema } from '@/server/dienste/hr/dto/hr.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt<{ id: string }>(
  async (anfrage, { params }) =>
    json(
      await hrService.addQualification(params.id, await rumpf(anfrage, createQualificationSchema)),
      201,
    ),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
