import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { inspectionsService } from '@/server/dienste/doors/inspections.service';
import { inspectionQuerySchema } from '@/server/dienste/doors/dto/inspection.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) => {
  return json(await inspectionsService.findAll(abfrage(anfrage, inspectionQuerySchema)));
});
