import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { ablagePruefen } from '@/server/ablage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Prüft die Dateiablage mit einer echten Rundreise.
 *
 * POST, weil dabei geschrieben wird – wenn auch nur eine Probedatei, die
 * anschließend wieder verschwindet.
 */
export const POST = geschuetzt(async () => json(await ablagePruefen()), [Role.GESCHAEFTSFUEHRUNG]);
