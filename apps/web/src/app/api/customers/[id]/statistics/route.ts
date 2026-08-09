import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { customers } from '@/server/dienste/customers/customers.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt<{ id: string }>(async (_anfrage, { params }) => {
  return json(await customers.statistics(params.id));
});
