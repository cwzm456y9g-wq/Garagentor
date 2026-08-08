import { rumpf } from '@/server/anfrage';
import { offen } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { anmelden } from '@/server/dienste/anmeldedienst';
import { geraetekontext } from '@/server/geraet';
import { anmeldeSchema } from '@/server/schemata/anmeldung';

// Argon2 und Prisma brauchen die Node-Laufzeit; auf Edge liefe beides nicht.
export const runtime = 'nodejs';
// Anmeldungen dürfen unter keinen Umständen aus einem Zwischenspeicher kommen.
export const dynamic = 'force-dynamic';

export const POST = offen(async (anfrage) => {
  const eingabe = await rumpf(anfrage, anmeldeSchema);
  return json(await anmelden(eingabe, geraetekontext(anfrage)));
});
