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

/**
 * Zuschlag für den Formularumschlag bei der Vorprüfung.
 *
 * Die Vorprüfung sieht nur `Content-Length`, und darin steckt nicht bloß die
 * Datei: Trennzeichen, Feldnamen, Dateiname und die übrigen Formularfelder
 * kommen dazu. Ohne Zuschlag scheiterte deshalb eine Datei von *genau* der
 * erlaubten Größe – mit der Begründung, sie sei größer als die Grenze, was
 * schlicht nicht stimmte.
 *
 * Ein Megabyte ist für den Umschlag reichlich bemessen und trotzdem
 * unschädlich: Die genaue Grenze zieht anschließend der Dienst an der
 * tatsächlichen Dateigröße. Die Vorprüfung ist nur der billige Schutz davor,
 * dass ein absurd großer Rumpf überhaupt erst in den Speicher gelesen wird.
 */
const UMSCHLAG_ZUSCHLAG = 1024 * 1024;

export const POST = geschuetzt(async (anfrage, { benutzer }) => {
  // Statt Multer nimmt Next.js das Formular selbst entgegen. Die Größe wird
  // vor dem Einlesen geprüft, damit eine zu große Datei nicht erst vollständig
  // im Speicher landet.
  const angekuendigt = anfrage.headers.get('content-length');
  const grenze = konfiguration().uploads.maxBytes;
  if (angekuendigt && Number.parseInt(angekuendigt, 10) > grenze + UMSCHLAG_ZUSCHLAG) {
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
