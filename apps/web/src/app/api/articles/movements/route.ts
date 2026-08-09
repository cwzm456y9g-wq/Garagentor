import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { articles } from '@/server/dienste/inventory/articles.service';
import { stockMovementQuerySchema } from '@/server/dienste/inventory/dto/inventory.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) => {
  return json(await articles.movements(abfrage(anfrage, stockMovementQuerySchema)));
});
