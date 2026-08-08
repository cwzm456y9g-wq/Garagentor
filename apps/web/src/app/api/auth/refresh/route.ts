import { rumpf } from '@/server/anfrage';
import { offen } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { erneuern } from '@/server/dienste/anmeldedienst';
import { geraetekontext } from '@/server/geraet';
import { erneuerungsSchema } from '@/server/schemata/anmeldung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = offen(async (anfrage) => {
  const eingabe = await rumpf(anfrage, erneuerungsSchema);
  return json(await erneuern(eingabe.refreshToken, geraetekontext(anfrage)));
});
