import { z } from 'zod';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { feldansichtService } from '@/server/dienste/feldansicht/feldansicht.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  datum: z
    .string()
    .refine((wert) => !Number.isNaN(Date.parse(wert)), {
      message: 'Bitte ein gültiges Datum angeben.',
    })
    .optional(),
});

// Die Feldansicht zeigt immer den eigenen Tag – die Benutzerkennung kommt aus
// dem Token, nicht aus der Adresszeile.
export const GET = geschuetzt(async (anfrage, { benutzer }) => {
  const { datum } = abfrage(anfrage, schema);
  return json(await feldansichtService.meinTag(benutzer.id, datum));
});
