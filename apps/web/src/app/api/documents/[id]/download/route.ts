import { geschuetzt } from '@/server/anmeldung';
import { datei } from '@/server/antwort';
import { documents } from '@/server/dienste/documents/documents.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Die Datei liegt in einem privaten Bucket. Sie geht nur über diesen Endpunkt
// hinaus, und der prüft vorher die Anmeldung.
export const GET = geschuetzt<{ id: string }>(async (_anfrage, { params }) => {
  const { inhalt, document } = await documents.fileFor(params.id);
  return datei(inhalt, { typ: document.mimeType, name: document.originalName });
});
