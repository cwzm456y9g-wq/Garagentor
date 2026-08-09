import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { documents } from '@/server/dienste/documents/documents.service';
import { updateDocumentSchema } from '@/server/dienste/documents/dto/document.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Kennung = { id: string };

export const GET = geschuetzt<Kennung>(async (_a, { params }) =>
  json(await documents.findOne(params.id)),
);

export const PATCH = geschuetzt<Kennung>(async (anfrage, { params }) =>
  json(await documents.update(params.id, await rumpf(anfrage, updateDocumentSchema))),
);

export const DELETE = geschuetzt<Kennung>(async (_a, { params }) =>
  json(await documents.remove(params.id)),
);
