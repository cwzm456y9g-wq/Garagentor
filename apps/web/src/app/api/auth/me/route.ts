import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { eigenesKonto } from '@/server/dienste/anmeldedienst';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (_anfrage, { benutzer }) => {
  return json(await eigenesKonto(benutzer.id));
});
