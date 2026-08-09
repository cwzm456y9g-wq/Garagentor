import { Role } from '@prisma/client';
import { abfrage, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { serviceReportsService } from '@/server/dienste/doors/service-reports.service';
import {
  createServiceReportSchema,
  serviceReportQuerySchema,
} from '@/server/dienste/doors/dto/service-report.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) => {
  return json(await serviceReportsService.findAll(abfrage(anfrage, serviceReportQuerySchema)));
});

export const POST = geschuetzt(
  async (anfrage) => {
    return json(
      await serviceReportsService.create(await rumpf(anfrage, createServiceReportSchema)),
      201,
    );
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
);
