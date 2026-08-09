import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { purchasingService } from '@/server/dienste/inventory/purchasing.service';
import { reorderSuggestionQuerySchema } from '@/server/dienste/inventory/dto/inventory.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) => {
  return json(
    await purchasingService.reorderSuggestions(abfrage(anfrage, reorderSuggestionQuerySchema)),
  );
});
