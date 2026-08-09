import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { serviceReportsService } from '@/server/dienste/doors/service-reports.service';
import { updateServiceReportSchema } from '@/server/dienste/doors/dto/service-report.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string };

export const GET = geschuetzt<Kennung>(async (_anfrage, { params }) => {
  return json(await serviceReportsService.findOne(params.id));
});

export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) => {
    return json(
      await serviceReportsService.update(
        params.id,
        await rumpf(anfrage, updateServiceReportSchema),
      ),
    );
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
);

export const DELETE = geschuetzt<Kennung>(
  async (_anfrage, { params }) => {
    return json(await serviceReportsService.remove(params.id));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
