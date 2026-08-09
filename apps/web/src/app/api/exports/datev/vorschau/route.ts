import { Role } from '@prisma/client';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { datevService } from '@/server/dienste/exports/datev.service';
import { datevQuerySchema } from '@/server/dienste/exports/dto/datev.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(
  async (anfrage) => {
    const stapel = await datevService.stapel(abfrage(anfrage, datevQuerySchema));
    return json({
      von: stapel.von,
      bis: stapel.bis,
      anzahl: stapel.buchungen.length,
      summe: stapel.summe,
      beanstandungen: stapel.beanstandungen,
      einstellungen: stapel.einstellungen,
      // Eine Handvoll Zeilen reicht zum Hinsehen; der Rest steht in der Datei.
      buchungen: stapel.buchungen.slice(0, 50),
    });
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG],
);
