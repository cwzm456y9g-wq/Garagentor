import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { normalizeRotation } from '../core/geometry';
import type { Box, PageRef, Rotation, Source } from '../core/types';

GlobalWorkerOptions.workerSrc = workerUrl;

/** Punkt (1/72 Zoll) in CSS-Pixel bei 100 % Zoom. */
export const PX_PER_PT = 96 / 72;

const docs = new Map<string, Promise<PDFDocumentProxy>>();

export function getPdf(source: Source): Promise<PDFDocumentProxy> {
  let p = docs.get(source.id);
  if (!p) {
    // pdf.js übernimmt den Puffer; die Werkstatt braucht ihre Kopie noch.
    p = getDocument({ data: source.bytes.slice() }).promise;
    docs.set(source.id, p);
  }
  return p;
}

/** Gibt ein nur kurz gebrauchtes Dokument wieder frei. */
export function forgetPdf(id: string) {
  const p = docs.get(id);
  docs.delete(id);
  void p?.then((d) => d.loadingTask.destroy()).catch(() => undefined);
}

export async function getPage(source: Source, index: number): Promise<PDFPageProxy> {
  return (await getPdf(source)).getPage(index + 1);
}

/** Maße einer Seite in Punkt, ohne Drehung, und ihre eigene Drehung. */
export interface PageBase {
  width: number;
  height: number;
  rotate: Rotation;
}

const baseCache = new Map<string, PageBase>();

export async function pageBase(source: Source, index: number): Promise<PageBase> {
  const key = `${source.id}:${index}`;
  const hit = baseCache.get(key);
  if (hit) return hit;
  const page = await getPage(source, index);
  const [x0, y0, x1, y1] = page.view as [number, number, number, number];
  const base = { width: x1 - x0, height: y1 - y0, rotate: normalizeRotation(page.rotate) };
  baseCache.set(key, base);
  return base;
}

export function blankBase(ref: PageRef): PageBase {
  const size = ref.blankSize ?? { width: 595.28, height: 841.89 };
  return { ...size, rotate: 0 };
}

export function displayDims(base: PageBase, ref: PageRef) {
  const rotation = normalizeRotation(base.rotate + ref.rotation);
  const swap = rotation === 90 || rotation === 270;
  return {
    rotation,
    width: swap ? base.height : base.width,
    height: swap ? base.width : base.height,
  };
}

/**
 * Zeichnet eine Seite in eine Leinwand. `scale` ist CSS-Pixel je Punkt; die
 * Leinwand bekommt zusätzlich die Pixeldichte des Bildschirms.
 */
export async function renderPage(
  canvas: HTMLCanvasElement,
  source: Source,
  ref: PageRef,
  scale: number,
  signal: AbortSignal,
  pixelRatio = window.devicePixelRatio || 1,
): Promise<void> {
  const page = await getPage(source, ref.pageIndex);
  if (signal.aborted) return;
  const rotation = normalizeRotation(page.rotate + ref.rotation);
  const viewport = page.getViewport({ scale: scale * pixelRatio, rotation });
  const scratch = document.createElement('canvas');
  scratch.width = Math.ceil(viewport.width);
  scratch.height = Math.ceil(viewport.height);
  const task = page.render({ canvas: scratch, viewport });
  signal.addEventListener('abort', () => task.cancel(), { once: true });
  try {
    await task.promise;
  } catch (err) {
    if (signal.aborted) return;
    throw err;
  }
  if (signal.aborted) return;
  // Erst fertig gezeichnet austauschen, damit beim Zoomen nichts flackert.
  canvas.width = scratch.width;
  canvas.height = scratch.height;
  canvas.getContext('2d')?.drawImage(scratch, 0, 0);
}

/** Bild einer Seite als PNG, z. B. für den Export oder zum Schwärzen. */
export async function rasterizePage(
  source: Source | null,
  ref: PageRef,
  dpi: number,
  blackBoxes: Box[] = [],
): Promise<Blob> {
  const scale = dpi / 72;
  const canvas = document.createElement('canvas');
  if (source) {
    const page = await getPage(source, ref.pageIndex);
    const rotation = normalizeRotation(page.rotate + ref.rotation);
    const viewport = page.getViewport({ scale, rotation });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
  } else {
    const dims = displayDims(blankBase(ref), ref);
    canvas.width = Math.ceil(dims.width * scale);
    canvas.height = Math.ceil(dims.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  for (const b of blackBoxes) {
    ctx.fillRect(
      Math.floor(b.x * canvas.width),
      Math.floor(b.y * canvas.height),
      Math.ceil(b.w * canvas.width) + 1,
      Math.ceil(b.h * canvas.height) + 1,
    );
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht erzeugt werden.'))),
      'image/png',
    ),
  );
}

export interface TextHit {
  pageKey: string;
  box: Box;
  snippet: string;
}

/**
 * Sucht Text auf den Seiten und liefert die Fundstellen als Rechtecke der
 * angezeigten Seite. Die Lage innerhalb eines Textstücks wird anhand der
 * Zeichenzahl geschätzt.
 */
export async function searchText(
  sources: Source[],
  pages: PageRef[],
  query: string,
  caseSensitive: boolean,
): Promise<TextHit[]> {
  const needle = caseSensitive ? query : query.toLocaleLowerCase('de');
  if (!needle) return [];
  const byId = new Map(sources.map((s) => [s.id, s]));
  const hits: TextHit[] = [];
  for (const ref of pages) {
    const source = ref.sourceId ? byId.get(ref.sourceId) : undefined;
    if (!source) continue;
    const page = await getPage(source, ref.pageIndex);
    const viewport = page.getViewport({
      scale: 1,
      rotation: normalizeRotation(page.rotate + ref.rotation),
    });
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const hay = caseSensitive ? item.str : item.str.toLocaleLowerCase('de');
      let from = 0;
      for (;;) {
        const at = hay.indexOf(needle, from);
        if (at < 0) break;
        from = at + needle.length;
        const [, , , , e, f] = item.transform as number[];
        const fontHeight =
          Math.hypot(item.transform[2] ?? 0, item.transform[3] ?? 0) || item.height;
        const charW = item.width / item.str.length;
        const x1 = (e ?? 0) + charW * at;
        const x2 = x1 + charW * needle.length;
        const y1 = (f ?? 0) - fontHeight * 0.2;
        const y2 = (f ?? 0) + fontHeight * 0.85;
        const [a, b] = viewport.convertToViewportPoint(x1, y1) as [number, number];
        const [c, d] = viewport.convertToViewportPoint(x2, y2) as [number, number];
        hits.push({
          pageKey: ref.key,
          box: {
            x: Math.min(a, c) / viewport.width,
            y: Math.min(b, d) / viewport.height,
            w: Math.abs(c - a) / viewport.width,
            h: Math.abs(d - b) / viewport.height,
          },
          snippet: item.str,
        });
      }
    }
  }
  return hits;
}

/** Der gesamte Text der Seiten, Seite für Seite. */
export async function extractText(sources: Source[], pages: PageRef[]): Promise<string> {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const parts: string[] = [];
  for (const [i, ref] of pages.entries()) {
    const source = ref.sourceId ? byId.get(ref.sourceId) : undefined;
    let text = '';
    if (source) {
      const content = await (await getPage(source, ref.pageIndex)).getTextContent();
      text = content.items
        .map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : '') : ''))
        .join('');
    }
    parts.push(`--- Seite ${i + 1} ---\n${text.trim()}`);
  }
  return parts.join('\n\n') + '\n';
}

export interface OutlineEntry {
  title: string;
  pageIndex: number | null;
  children: OutlineEntry[];
}

/** Lesezeichen eines Dokuments mit der Seite, auf die sie zeigen. */
export async function getOutline(source: Source): Promise<OutlineEntry[]> {
  const pdf = await getPdf(source);
  const outline = await pdf.getOutline();
  if (!outline) return [];
  type Item = (typeof outline)[number];
  const resolve = async (item: Item): Promise<OutlineEntry> => {
    let pageIndex: number | null = null;
    try {
      const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
      const target = dest?.[0];
      if (target && typeof target === 'object') pageIndex = await pdf.getPageIndex(target);
      else if (typeof target === 'number') pageIndex = target;
    } catch {
      pageIndex = null;
    }
    return { title: item.title, pageIndex, children: await Promise.all(item.items.map(resolve)) };
  };
  return Promise.all(outline.map(resolve));
}
