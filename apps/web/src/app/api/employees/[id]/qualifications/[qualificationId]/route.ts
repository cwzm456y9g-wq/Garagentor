import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { hrService } from '@/server/dienste/hr/hr.service';
import { updateQualificationSchema } from '@/server/dienste/hr/dto/hr.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string; qualificationId: string };

export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) =>
    json(
      await hrService.updateQualification(
        params.id,
        params.qualificationId,
        await rumpf(anfrage, updateQualificationSchema),
      ),
    ),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);

export const DELETE = geschuetzt<Kennung>(
  async (_a, { params }) =>
    json(await hrService.removeQualification(params.id, params.qualificationId)),
  [Role.GESCHAEFTSFUEHRUNG],
);
