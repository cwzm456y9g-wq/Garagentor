import { Role } from '@prisma/client';
import { RUMPF_GROSS, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { serviceReportsService } from '@/server/dienste/doors/service-reports.service';
import { completeServiceReportSchema } from '@/server/dienste/doors/dto/service-report.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Größerer Rumpf: der Abschluss trägt die Unterschriften von Kunde und Monteur.
export const POST = geschuetzt<{ id: string }>(
  async (anfrage, { params }) => {
    const eingabe = await rumpf(anfrage, completeServiceReportSchema, RUMPF_GROSS);
    return json(await serviceReportsService.complete(params.id, eingabe));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
);
