import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { articles } from '@/server/dienste/inventory/articles.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async () => json(await articles.belowMinStock()));
