import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { purchasingService } from '@/server/dienste/inventory/purchasing.service';
import { receiveDeliverySchema } from '@/server/dienste/inventory/dto/inventory.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Wareneingang darf auch der Monteur buchen – er nimmt die Lieferung an.
export const POST = geschuetzt<{ id: string }>(
  async (anfrage, { params, benutzer }) => {
    const eingabe = await rumpf(anfrage, receiveDeliverySchema);
    return json(await purchasingService.receiveDelivery(params.id, eingabe, benutzer.id));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
);
