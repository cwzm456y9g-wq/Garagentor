import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { dunningService } from '@/server/dienste/invoices/dunning.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt(async () => {
  return json(await dunningService.run());
}, [Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG]);
