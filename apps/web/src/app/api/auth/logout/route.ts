import { rumpf } from '@/server/anfrage';
import { offen } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { abmelden } from '@/server/dienste/anmeldedienst';
import { erneuerungsSchema } from '@/server/schemata/anmeldung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = offen(async (anfrage) => {
  const eingabe = await rumpf(anfrage, erneuerungsSchema);
  return json(await abmelden(eingabe.refreshToken));
});
