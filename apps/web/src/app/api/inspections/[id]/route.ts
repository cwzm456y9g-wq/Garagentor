import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { inspectionsService } from '@/server/dienste/doors/inspections.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt<{ id: string }>(async (_anfrage, { params }) => {
  return json(await inspectionsService.findOne(params.id));
});
