import { Role } from '@prisma/client';
import { abfrage, rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { articles } from '@/server/dienste/inventory/articles.service';
import {
  articleQuerySchema,
  createArticleSchema,
} from '@/server/dienste/inventory/dto/inventory.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) => {
  return json(await articles.findAll(abfrage(anfrage, articleQuerySchema)));
});

export const POST = geschuetzt(
  async (anfrage) => {
    return json(await articles.create(await rumpf(anfrage, createArticleSchema)), 201);
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
