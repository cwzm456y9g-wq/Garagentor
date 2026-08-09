import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { dunningService } from '@/server/dienste/invoices/dunning.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vorschau: zeigt, was ein Mahnlauf tun würde, ohne etwas zu buchen.
export const GET = geschuetzt(async () => {
  return json(await dunningService.preview());
}, [Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG, Role.BUERO]);
