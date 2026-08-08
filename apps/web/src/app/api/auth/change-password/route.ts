import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { passwortAendern } from '@/server/dienste/anmeldedienst';
import { passwortwechselSchema } from '@/server/schemata/anmeldung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt(async (anfrage, { benutzer }) => {
  const eingabe = await rumpf(anfrage, passwortwechselSchema);
  return json(await passwortAendern(benutzer.id, eingabe));
});
