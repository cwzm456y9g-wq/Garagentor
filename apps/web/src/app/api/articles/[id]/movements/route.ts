import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { articles } from '@/server/dienste/inventory/articles.service';
import { stockMovementSchema } from '@/server/dienste/inventory/dto/inventory.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Der Monteur bucht Material ab, das er vor Ort verbraucht hat. Die Buchung
// wird ihm zugeschrieben, damit im Lagerjournal steht, wer sie veranlasst hat.
export const POST = geschuetzt<{ id: string }>(
  async (anfrage, { params, benutzer }) => {
    const eingabe = await rumpf(anfrage, stockMovementSchema);
    return json(await articles.recordMovement(params.id, eingabe, benutzer.id), 201);
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
);
