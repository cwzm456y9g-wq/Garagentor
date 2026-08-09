import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { invoicesService } from '@/server/dienste/invoices/invoices.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Eine gebuchte Zahlung wieder zu entfernen ist ein Eingriff in die
// Buchhaltung – deshalb enger gefasst als das Buchen selbst.
export const DELETE = geschuetzt<{ id: string; paymentId: string }>(
  async (_anfrage, { params }) => {
    return json(await invoicesService.removePayment(params.id, params.paymentId));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG],
);
