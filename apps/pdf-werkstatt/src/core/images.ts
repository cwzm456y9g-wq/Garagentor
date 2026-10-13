import { PDFDocument } from 'pdf-lib';

export interface ImageInput {
  bytes: Uint8Array;
  type: 'png' | 'jpg';
}

export type ImagePageSize = 'fit' | 'a4';

const A4 = { width: 595.28, height: 841.89 };
const A4_MARGIN = 28;

/**
 * Macht aus Bildern ein PDF mit einer Seite je Bild. „fit“ nimmt die Größe
 * des Bildes (96 dpi), „a4“ setzt es zentriert und eingepasst auf A4, im
 * Querformat, wenn das Bild breiter als hoch ist.
 */
export async function imagesToPdf(
  images: ImageInput[],
  pageSize: ImagePageSize = 'fit',
): Promise<Uint8Array> {
  if (images.length === 0) throw new Error('Keine Bilder ausgewählt.');
  const doc = await PDFDocument.create();
  for (const input of images) {
    const image =
      input.type === 'png' ? await doc.embedPng(input.bytes) : await doc.embedJpg(input.bytes);
    const natural = { width: image.width * 0.75, height: image.height * 0.75 };
    if (pageSize === 'fit') {
      const page = doc.addPage([natural.width, natural.height]);
      page.drawImage(image, { x: 0, y: 0, ...natural });
      continue;
    }
    const landscape = natural.width > natural.height;
    const pw = landscape ? A4.height : A4.width;
    const ph = landscape ? A4.width : A4.height;
    const scale = Math.min(
      (pw - 2 * A4_MARGIN) / natural.width,
      (ph - 2 * A4_MARGIN) / natural.height,
      1,
    );
    const width = natural.width * scale;
    const height = natural.height * scale;
    const page = doc.addPage([pw, ph]);
    page.drawImage(image, { x: (pw - width) / 2, y: (ph - height) / 2, width, height });
  }
  return doc.save();
}
