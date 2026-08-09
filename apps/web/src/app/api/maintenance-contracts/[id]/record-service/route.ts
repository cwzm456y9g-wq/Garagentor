import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { serviceReportsService } from '@/server/dienste/doors/service-reports.service';
import { recordMaintenanceSchema } from '@/server/dienste/doors/dto/service-report.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt<{ id: string }>(
  async (anfrage, { params }) => {
    return json(
      await serviceReportsService.recordMaintenance(
        params.id,
        await rumpf(anfrage, recordMaintenanceSchema),
      ),
    );
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
);
