import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { dunningService } from '@/server/dienste/invoices/dunning.service';
import { createDunningSchema } from '@/server/dienste/invoices/dto/dunning.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt<{ id: string }>(
  async (anfrage, { params }) => {
    const eingabe = await rumpf(anfrage, createDunningSchema);
    return json(await dunningService.createForInvoice(params.id, eingabe.level), 201);
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG],
);
