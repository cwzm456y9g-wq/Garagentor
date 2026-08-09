import { Role } from '@prisma/client';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { dunningService } from '@/server/dienste/invoices/dunning.service';
import { dunningQuerySchema } from '@/server/dienste/invoices/dto/dunning.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(
  async (anfrage) => {
    return json(await dunningService.findAll(abfrage(anfrage, dunningQuerySchema)));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG, Role.BUERO],
);
