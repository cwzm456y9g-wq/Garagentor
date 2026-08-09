import { Role } from '@prisma/client';
import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { articles } from '@/server/dienste/inventory/articles.service';
import { updateArticleSchema } from '@/server/dienste/inventory/dto/inventory.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string };

export const GET = geschuetzt<Kennung>(async (_a, { params }) =>
  json(await articles.findOne(params.id)),
);

export const PATCH = geschuetzt<Kennung>(
  async (anfrage, { params }) => {
    return json(await articles.update(params.id, await rumpf(anfrage, updateArticleSchema)));
  },
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);

export const DELETE = geschuetzt<Kennung>(
  async (_a, { params }) => json(await articles.remove(params.id)),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
