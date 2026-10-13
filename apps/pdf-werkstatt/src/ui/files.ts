import { imagesToPdf, type ImageInput, type ImagePageSize } from '../core/images';
import { inspectPdf, type PdfInfo } from '../core/inspect';
import type { Source } from '../core/types';
import { newId } from './state';

export const ACCEPT = 'application/pdf,.pdf,image/png,image/jpeg,image/webp,image/gif,image/bmp';

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isImage = (f: File) => f.type.startsWith('image/');

/** Wandelt jedes Bild, das kein PNG/JPEG ist, über eine Leinwand in PNG um. */
async function toImageInput(file: File): Promise<ImageInput> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === 'image/png') return { bytes, type: 'png' };
  if (file.type === 'image/jpeg') return { bytes, type: 'jpg' };
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error(`${file.name} lässt sich nicht lesen.`))),
      'image/png',
    ),
  );
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: 'png' };
}

export interface OpenedFile {
  source: Source;
  info: PdfInfo;
}

/**
 * Liest gewählte Dateien ein. PDFs werden je eine Quelle; Bilder werden
 * zusammen zu einem PDF mit einer Seite je Bild.
 */
export async function openFiles(files: File[], imageSize: ImagePageSize): Promise<OpenedFile[]> {
  const out: OpenedFile[] = [];
  const images: File[] = [];
  for (const file of files) {
    if (isPdf(file)) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const info = await inspectPdf(bytes, file.name);
      out.push({ source: { id: newId('quelle'), name: file.name, bytes }, info });
    } else if (isImage(file)) {
      images.push(file);
    } else {
      throw new Error(`„${file.name}“ ist weder PDF noch Bild.`);
    }
  }
  if (images.length > 0) {
    const bytes = await imagesToPdf(await Promise.all(images.map(toImageInput)), imageSize);
    const name = images.length === 1 ? images[0]!.name.replace(/\.[^.]+$/, '.pdf') : 'bilder.pdf';
    out.push({ source: { id: newId('quelle'), name, bytes }, info: await inspectPdf(bytes, name) });
  }
  return out;
}

export function download(data: Blob | Uint8Array, name: string, type = 'application/pdf') {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Druckt ein PDF über einen unsichtbaren Rahmen mit dem Betrachter des Browsers. */
export function printPdf(bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, '_blank');
    }
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  document.body.append(frame);
}

export const readAsDataUrl = (file: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error ?? new Error('Datei lässt sich nicht lesen.'));
    r.readAsDataURL(file);
  });

/** PNG/JPEG direkt, alles andere als PNG, damit pdf-lib es einbetten kann. */
export async function imageFileToDataUrl(file: File): Promise<string> {
  if (file.type === 'image/png' || file.type === 'image/jpeg') return readAsDataUrl(file);
  const input = await toImageInput(file);
  return readAsDataUrl(new Blob([input.bytes as BlobPart], { type: 'image/png' }));
}

export const baseName = (name: string) => name.replace(/\.pdf$/i, '');
