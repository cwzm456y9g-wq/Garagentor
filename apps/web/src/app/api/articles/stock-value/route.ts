import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { articles } from '@/server/dienste/inventory/articles.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Der Lagerwert rechnet mit Einkaufspreisen und bleibt deshalb den Rollen
// vorbehalten, die die Marge ohnehin kennen.
export const GET = geschuetzt(
  async () => json(await articles.stockValue()),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
);
