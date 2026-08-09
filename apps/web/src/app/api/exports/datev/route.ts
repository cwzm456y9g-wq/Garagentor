import { Role } from '@prisma/client';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { datei } from '@/server/antwort';
import { datevService } from '@/server/dienste/exports/datev.service';
import { datevQuerySchema } from '@/server/dienste/exports/dto/datev.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(
  async (anfrage) => {
    const { inhalt, dateiname } = await datevService.datei(abfrage(anfrage, datevQuerySchema));
    // Windows-1252 gehört in den Kopf, sonst rät der Browser auf UTF-8 und
    // aus „Straße" wird beim Steuerberater Zeichensalat.
    return datei(inhalt, { typ: 'text/csv; charset=windows-1252', name: dateiname });
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG],
);
