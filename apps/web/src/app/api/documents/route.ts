import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { konfiguration } from '@/server/konfiguration';
import { ungueltig } from '@/server/fehler';
import { documents } from '@/server/dienste/documents/documents.service';
import {
  documentQuerySchema,
  uploadDocumentSchema,
} from '@/server/dienste/documents/dto/document.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async (anfrage) =>
  json(await documents.findAll(abfrage(anfrage, documentQuerySchema))),
);

export const POST = geschuetzt(async (anfrage, { benutzer }) => {
  // Statt Multer nimmt Next.js das Formular selbst entgegen. Die Größe wird
  // vor dem Einlesen geprüft, damit eine zu große Datei nicht erst vollständig
  // im Speicher landet.
  const angekuendigt = anfrage.headers.get('content-length');
  const grenze = konfiguration().uploads.maxBytes;
  if (angekuendigt && Number.parseInt(angekuendigt, 10) > grenze) {
    throw ungueltig(`Die Datei ist größer als ${Math.round(grenze / 1024 / 1024)} MB.`);
  }

  const formular = await anfrage.formData();
  const datei = formular.get('file');
  if (!(datei instanceof File)) {
    throw ungueltig('Es wurde keine Datei übermittelt.');
  }

  const felder: Record<string, string> = {};
  for (const [schluessel, wert] of formular.entries()) {
    if (schluessel !== 'file' && typeof wert === 'string' && wert !== '') felder[schluessel] = wert;
  }

  return json(
    await documents.upload(
      {
        originalname: datei.name,
        mimetype: datei.type,
        size: datei.size,
        buffer: Buffer.from(await datei.arrayBuffer()),
      },
      uploadDocumentSchema.parse(felder),
      benutzer.id,
    ),
    201,
  );
});
