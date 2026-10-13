import { PDFDocument } from 'pdf-lib';
import type { Metadata } from './types';

export class EncryptedPdfError extends Error {
  constructor(name: string) {
    super(`„${name}“ ist verschlüsselt. Bitte zuerst den Kennwortschutz entfernen.`);
  }
}

export interface PdfInfo {
  pageCount: number;
  metadata: Metadata;
}

/** Prüft, ob sich eine Datei bearbeiten lässt, und liest Seitenzahl und Eigenschaften. */
export async function inspectPdf(bytes: Uint8Array, name: string): Promise<PdfInfo> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (err) {
    if (err instanceof Error && /encrypt/i.test(err.message)) throw new EncryptedPdfError(name);
    throw new Error(`„${name}“ ist kein lesbares PDF.`);
  }
  return {
    pageCount: doc.getPageCount(),
    metadata: {
      title: doc.getTitle() ?? '',
      author: doc.getAuthor() ?? '',
      subject: doc.getSubject() ?? '',
      keywords: doc.getKeywords() ?? '',
    },
  };
}
