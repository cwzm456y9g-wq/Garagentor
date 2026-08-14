import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { mailService } from '@/server/dienste/mail/mail.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Prüft die Verbindung zum Mailserver, ohne etwas zu verschicken.
 *
 * POST, obwohl nichts entsteht: Der Aufruf baut eine Verbindung nach außen auf
 * und gehört deshalb nicht in etwas, das ein Browser von sich aus wiederholen
 * oder zwischenspeichern darf.
 */
export const POST = geschuetzt(
  async () => json(await mailService.pruefen()),
  [Role.GESCHAEFTSFUEHRUNG],
);
