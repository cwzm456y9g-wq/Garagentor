import { readFile } from 'node:fs/promises';
import { geschuetzt } from '@/server/anmeldung';
import { datei } from '@/server/antwort';
import { documents } from '@/server/dienste/documents/documents.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt<{ id: string }>(async (_anfrage, { params }) => {
  const { path, document } = await documents.fileFor(params.id);
  return datei(await readFile(path), { typ: document.mimeType, name: document.originalName });
});
