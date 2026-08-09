import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { datei } from '@/server/antwort';
import { pdf } from '@/server/dienste/pdf/pdf.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Wie im Mahnwesen selbst: das Schreiben geht nur die Stellen etwas an, die
// auch mahnen dürfen.
export const GET = geschuetzt<{ id: string }>(
  async (_anfrage, { params }) => {
    const { buffer, dateiname } = await pdf.mahnung(params.id);
    return datei(buffer, { typ: 'application/pdf', name: dateiname, anhang: false });
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG, Role.BUERO],
);
