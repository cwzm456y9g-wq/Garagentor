import {
  BlendMode,
  LineCapStyle,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFHexString,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFString,
  PDFTextField,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import {
  displaySize,
  normalizeRotation,
  toPdfPoint,
  toPdfRect,
  type PageGeometry,
} from './geometry';
import type { Annotation, Box, Color, Edits, FormValues, PageRef, Position, Source } from './types';

const MARGIN = 24;
const TEXT_PADDING = 2;
export const LINE_HEIGHT = 1.2;

export class RedactionNotAppliedError extends Error {
  constructor() {
    super('Eine Schwärzung wurde nicht angewendet. Die Datei wurde deshalb nicht gespeichert.');
  }
}

export function hexToRgb(hex: Color) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return rgb(0, 0, 0);
  return rgb(parseInt(m[1]!, 16) / 255, parseInt(m[2]!, 16) / 255, parseInt(m[3]!, 16) / 255);
}

/**
 * Die Standardschriften können nur WinAnsi (also auch ä, ö, ü, ß, €). Alles
 * andere wird ersetzt statt beim Speichern abzubrechen.
 */
export function safeText(font: PDFFont, text: string): string {
  let out = '';
  for (const ch of text) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += '?';
    }
  }
  return out;
}

/** Bricht Text in Zeilen um, die höchstens `maxWidth` Punkt breit sind. */
export function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/(\s+)/);
    let line = '';
    for (const word of words) {
      const candidate = line + word;
      if (line !== '' && font.widthOfTextAtSize(candidate.trimEnd(), size) > maxWidth) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = candidate;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

interface Ctx {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  images: Map<string, PDFImage>;
}

/** Text auf der angezeigten Seite: Grundlinie links bei (xPt, yPt) von oben links. */
function drawDisplayText(
  page: PDFPage,
  g: PageGeometry,
  text: string,
  xPt: number,
  baselinePt: number,
  size: number,
  font: PDFFont,
  color: Color,
  opacity = 1,
) {
  const s = displaySize(g);
  const p = toPdfPoint({ x: xPt / s.width, y: baselinePt / s.height }, g);
  page.drawText(text, {
    x: p.x,
    y: p.y,
    size,
    font,
    color: hexToRgb(color),
    rotate: degrees(g.rotation),
    opacity,
  });
}

function drawAligned(
  page: PDFPage,
  g: PageGeometry,
  ctx: Ctx,
  text: string,
  position: Position,
  size: number,
) {
  if (!text) return;
  const t = safeText(ctx.regular, text);
  const s = displaySize(g);
  const width = ctx.regular.widthOfTextAtSize(t, size);
  const [vertical, horizontal] = position.split('-') as ['top' | 'bottom', string];
  const x =
    horizontal === 'left'
      ? MARGIN
      : horizontal === 'right'
        ? s.width - MARGIN - width
        : (s.width - width) / 2;
  const baseline = vertical === 'top' ? MARGIN + size * 0.8 : s.height - MARGIN;
  drawDisplayText(page, g, t, x, baseline, size, ctx.regular, '#333333');
}

async function embedDataUrl(ctx: Ctx, dataUrl: string): Promise<PDFImage> {
  const cached = ctx.images.get(dataUrl);
  if (cached) return cached;
  const [head, data = ''] = dataUrl.split(',');
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const image = head?.includes('image/png')
    ? await ctx.doc.embedPng(bytes)
    : await ctx.doc.embedJpg(bytes);
  ctx.images.set(dataUrl, image);
  return image;
}

function drawTextBox(
  page: PDFPage,
  g: PageGeometry,
  box: Box,
  text: string,
  size: number,
  font: PDFFont,
  color: Color,
) {
  const s = displaySize(g);
  const left = box.x * s.width + TEXT_PADDING;
  const top = box.y * s.height + TEXT_PADDING;
  const maxWidth = Math.max(box.w * s.width - 2 * TEXT_PADDING, size);
  const lines = wrapText(font, safeText(font, text), size, maxWidth);
  lines.forEach((line, i) => {
    if (!line) return;
    const baseline = top + i * size * LINE_HEIGHT + size * 0.85;
    drawDisplayText(page, g, line, left, baseline, size, font, color);
  });
}

async function drawAnnotation(page: PDFPage, g: PageGeometry, ctx: Ctx, a: Annotation) {
  const s = displaySize(g);
  switch (a.kind) {
    case 'text':
      drawTextBox(page, g, a.box, a.text, a.fontSize, a.bold ? ctx.bold : ctx.regular, a.color);
      return;
    case 'highlight': {
      const r = toPdfRect(a.box, g);
      page.drawRectangle({
        ...r,
        rotate: degrees(r.rotate),
        color: hexToRgb(a.color),
        opacity: 0.4,
        blendMode: BlendMode.Multiply,
      });
      return;
    }
    case 'whiteout': {
      const r = toPdfRect(a.box, g);
      page.drawRectangle({ ...r, rotate: degrees(r.rotate), color: rgb(1, 1, 1) });
      return;
    }
    case 'redact':
      // Schwärzungen wirken nur, wenn die Seite vorher als Bild ersetzt wurde.
      throw new RedactionNotAppliedError();
    case 'rect': {
      const r = toPdfRect(a.box, g);
      page.drawRectangle({
        ...r,
        rotate: degrees(r.rotate),
        borderColor: hexToRgb(a.color),
        borderWidth: a.strokeWidth,
        ...(a.fill ? { color: hexToRgb(a.color), opacity: 0.25, borderOpacity: 1 } : {}),
      });
      return;
    }
    case 'ellipse': {
      const c = toPdfPoint({ x: a.box.x + a.box.w / 2, y: a.box.y + a.box.h / 2 }, g);
      const halfW = (a.box.w * s.width) / 2;
      const halfH = (a.box.h * s.height) / 2;
      const swap = g.rotation === 90 || g.rotation === 270;
      page.drawEllipse({
        x: c.x,
        y: c.y,
        xScale: swap ? halfH : halfW,
        yScale: swap ? halfW : halfH,
        borderColor: hexToRgb(a.color),
        borderWidth: a.strokeWidth,
      });
      return;
    }
    case 'line': {
      const from = toPdfPoint(a.from, g);
      const to = toPdfPoint(a.to, g);
      const color = hexToRgb(a.color);
      const opts = { thickness: a.strokeWidth, color, lineCap: LineCapStyle.Round };
      page.drawLine({ start: from, end: to, ...opts });
      if (a.arrow) {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const len = 8 + a.strokeWidth * 2;
        for (const side of [-1, 1]) {
          const t = angle + Math.PI - (side * Math.PI) / 7;
          page.drawLine({
            start: to,
            end: { x: to.x + Math.cos(t) * len, y: to.y + Math.sin(t) * len },
            ...opts,
          });
        }
      }
      return;
    }
    case 'ink': {
      if (a.points.length === 0) return;
      const pts = a.points.map((p) => toPdfPoint(p, g));
      // drawSvgPath zählt y nach unten; deshalb mit negiertem y am Ursprung.
      const path =
        pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${-p.y}`).join(' ') +
        (pts.length === 1 ? ` L ${pts[0]!.x + 0.01} ${-pts[0]!.y}` : '');
      page.drawSvgPath(path, {
        x: 0,
        y: 0,
        borderColor: hexToRgb(a.color),
        borderWidth: a.strokeWidth,
        borderLineCap: LineCapStyle.Round,
      });
      return;
    }
    case 'image': {
      const image = await embedDataUrl(ctx, a.dataUrl);
      const r = toPdfRect(a.box, g);
      page.drawImage(image, { ...r, rotate: degrees(r.rotate) });
      return;
    }
    case 'stamp': {
      const r = toPdfRect(a.box, g);
      const color = hexToRgb(a.color);
      const border = Math.max(1.5, Math.min(r.width, r.height) * 0.06);
      page.drawRectangle({
        ...r,
        rotate: degrees(r.rotate),
        borderColor: color,
        borderWidth: border,
        borderOpacity: 0.9,
      });
      const text = safeText(ctx.bold, a.text.toUpperCase());
      const w = a.box.w * s.width;
      const h = a.box.h * s.height;
      const size = Math.max(
        4,
        Math.min(h * 0.55, ((w - 4 * border) / ctx.bold.widthOfTextAtSize(text, 1)) * 0.95),
      );
      const tw = ctx.bold.widthOfTextAtSize(text, size);
      drawDisplayText(
        page,
        g,
        text,
        a.box.x * s.width + (w - tw) / 2,
        a.box.y * s.height + h / 2 + size * 0.35,
        size,
        ctx.bold,
        a.color,
        0.9,
      );
      return;
    }
    case 'note': {
      // Ein echter PDF-Kommentar, den jeder PDF-Betrachter als Notiz anzeigt.
      const p = toPdfPoint({ x: a.box.x, y: a.box.y }, g);
      const c = hexToRgb(a.color);
      const annot = ctx.doc.context.obj({
        Type: 'Annot',
        Subtype: 'Text',
        Rect: [p.x, p.y - 20, p.x + 20, p.y],
        Contents: PDFHexString.fromText(a.text),
        C: [c.red, c.green, c.blue],
        Name: 'Comment',
        F: 4,
        M: PDFString.fromDate(new Date()),
      });
      page.node.addAnnot(ctx.doc.context.register(annot));
      return;
    }
  }
}

function applyFormValues(doc: PDFDocument, values: Record<string, string | boolean>) {
  const form = doc.getForm();
  for (const [name, value] of Object.entries(values)) {
    const field = form.getFieldMaybe(name);
    if (!field) continue;
    if (field instanceof PDFTextField) field.setText(String(value));
    else if (field instanceof PDFCheckBox) {
      if (value) field.check();
      else field.uncheck();
    } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
      if (value === '') field.clear();
      else field.select(String(value));
    } else if (field instanceof PDFRadioGroup) {
      if (value === '') field.clear();
      else field.select(String(value));
    }
  }
}

async function loadSource(source: Source, values: FormValues, flatten: boolean) {
  const doc = await PDFDocument.load(source.bytes, { updateMetadata: false });
  const own = values[source.id];
  if (own && Object.keys(own).length > 0) applyFormValues(doc, own);
  if (flatten) {
    const form = doc.getForm();
    if (form.getFields().length > 0) form.flatten();
  } else if (own && Object.keys(own).length > 0) {
    doc.getForm().updateFieldAppearances();
  }
  return doc;
}

/**
 * Entfernt Formularfelder, deren Widgets auf keiner Seite mehr liegen, etwa
 * weil ihre Seite gelöscht oder geschwärzt wurde.
 */
function pruneOrphanFields(doc: PDFDocument, pages: PDFPage[]) {
  // doc.getPages() kann nach removePage veraltet sein; daher die eigene Liste.
  const onPages = new Set<string>();
  for (const page of pages) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) onPages.add(String(annots.get(i)));
  }
  const form = doc.getForm();
  for (const field of form.getFields()) {
    const widgets = field.acroField.getWidgets();
    const placed = widgets.some((w) => {
      const ref = doc.context.getObjectRef(w.dict);
      return ref ? onPages.has(String(ref)) : false;
    });
    // form.removeField sucht die Seite des Widgets und scheitert genau hier.
    if (!placed) form.acroForm.removeField(field.acroField);
  }
}

const formatNumber = (n: number, pad: number) =>
  pad > 0 ? String(n).padStart(pad, '0') : String(n);

/** Fügt die Seiten zusammen, wendet alle Änderungen an und liefert die neue Datei. */
export async function assemble(
  sources: Source[],
  pages: PageRef[],
  edits: Edits,
): Promise<Uint8Array> {
  if (pages.length === 0) throw new Error('Das Dokument hat keine Seiten.');
  const byId = new Map(sources.map((s) => [s.id, s]));
  const loaded = new Map<string, PDFDocument>();
  const load = async (id: string) => {
    let doc = loaded.get(id);
    if (!doc) {
      const source = byId.get(id);
      if (!source) throw new Error(`Unbekannte Quelle ${id}.`);
      doc = await loadSource(source, edits.formValues, edits.flattenForms);
      loaded.set(id, doc);
    }
    return doc;
  };

  // Die erste Quelle dient als Grundlage, damit Formulare, Lesezeichen und
  // Eigenschaften erhalten bleiben, wenn nur ein Dokument bearbeitet wird.
  const baseId = pages.find((p) => p.sourceId !== null)?.sourceId ?? null;
  const out = baseId ? await load(baseId) : await PDFDocument.create();
  const basePages = out.getPages();
  for (let i = out.getPageCount() - 1; i >= 0; i--) out.removePage(i);
  const usedBase = new Set<number>();
  // Die Grundlage hat ihre Seiten gerade abgegeben. Wird eine ihrer Seiten
  // ein zweites Mal gebraucht, kommt sie aus einer unberührten Kopie.
  let baseCopy: PDFDocument | null = null;
  const copySource = async (id: string) => {
    if (id !== baseId) return load(id);
    baseCopy ??= await loadSource(byId.get(id)!, edits.formValues, edits.flattenForms);
    return baseCopy;
  };

  const outPages: { page: PDFPage; ref: PageRef; originalRotation: number }[] = [];
  for (const ref of pages) {
    let page: PDFPage;
    if (ref.sourceId === null) {
      const size = ref.blankSize ?? { width: 595.28, height: 841.89 };
      page = out.addPage([size.width, size.height]);
    } else if (ref.sourceId === baseId && !usedBase.has(ref.pageIndex)) {
      const original = basePages[ref.pageIndex];
      if (!original) throw new Error(`Seite ${ref.pageIndex + 1} fehlt.`);
      usedBase.add(ref.pageIndex);
      page = out.addPage(original);
    } else {
      const src = await copySource(ref.sourceId);
      const [copied] = await out.copyPages(src, [ref.pageIndex]);
      page = out.addPage(copied!);
    }
    outPages.push({ page, ref, originalRotation: page.getRotation().angle });
  }

  const ctx: Ctx = {
    doc: out,
    regular: await out.embedFont(StandardFonts.Helvetica),
    bold: await out.embedFont(StandardFonts.HelveticaBold),
    images: new Map(),
  };

  // Geschwärzte Seiten durch ihr Bild ersetzen.
  for (let i = 0; i < outPages.length; i++) {
    const entry = outPages[i]!;
    const raster = edits.rasterizedPages[entry.ref.key];
    if (!raster) continue;
    const crop = entry.page.getCropBox();
    const g: PageGeometry = {
      x0: 0,
      y0: 0,
      width: crop.width,
      height: crop.height,
      rotation: normalizeRotation(entry.originalRotation + entry.ref.rotation),
    };
    const size = displaySize(g);
    const image = await out.embedPng(raster.png);
    out.removePage(i);
    const replacement = out.insertPage(i, [size.width, size.height]);
    replacement.drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
    outPages[i] = { page: replacement, ref: { ...entry.ref, rotation: 0 }, originalRotation: 0 };
  }

  const byPage = new Map<string, Annotation[]>();
  for (const a of edits.annotations) {
    const list = byPage.get(a.pageKey) ?? [];
    list.push(a);
    byPage.set(a.pageKey, list);
  }

  const total = outPages.length;
  for (let i = 0; i < total; i++) {
    const { page, ref, originalRotation } = outPages[i]!;
    const rotation = normalizeRotation(originalRotation + ref.rotation);
    page.setRotation(degrees(rotation));
    const crop = page.getCropBox();
    const g: PageGeometry = {
      x0: crop.x,
      y0: crop.y,
      width: crop.width,
      height: crop.height,
      rotation,
    };
    const rasterized = Boolean(edits.rasterizedPages[ref.key]);

    for (const a of byPage.get(ref.key) ?? []) {
      if (a.kind === 'redact' && rasterized) continue;
      await drawAnnotation(page, g, ctx, a);
    }

    const hf = edits.headerFooter;
    if (hf) {
      const fill = (t: string) =>
        t
          .replaceAll('{n}', String(i + 1))
          .replaceAll('{total}', String(total))
          .replaceAll('{date}', new Date().toLocaleDateString('de-DE'));
      const slots: [string, Position][] = [
        [hf.headerLeft, 'top-left'],
        [hf.headerCenter, 'top-center'],
        [hf.headerRight, 'top-right'],
        [hf.footerLeft, 'bottom-left'],
        [hf.footerCenter, 'bottom-center'],
        [hf.footerRight, 'bottom-right'],
      ];
      for (const [text, pos] of slots) drawAligned(page, g, ctx, fill(text), pos, hf.fontSize);
    }

    const pn = edits.pageNumbers;
    if (pn && !(pn.skipFirst && i === 0)) {
      const n = pn.startAt + i - (pn.skipFirst ? 1 : 0);
      const lastNumber = pn.startAt + total - 1 - (pn.skipFirst ? 1 : 0);
      const text = pn.format
        .replaceAll('{n}', formatNumber(n, pn.padDigits))
        .replaceAll('{total}', String(lastNumber));
      drawAligned(page, g, ctx, text, pn.position, pn.fontSize);
    }

    const wm = edits.watermark;
    if (wm && wm.text.trim()) {
      const text = safeText(ctx.bold, wm.text);
      const tw = ctx.bold.widthOfTextAtSize(text, wm.fontSize);
      const c = toPdfPoint({ x: 0.5, y: 0.5 }, g);
      const theta = ((rotation + wm.angle) * Math.PI) / 180;
      const h = wm.fontSize * 0.35;
      page.drawText(text, {
        x: c.x - (Math.cos(theta) * tw) / 2 + Math.sin(theta) * h,
        y: c.y - (Math.sin(theta) * tw) / 2 - Math.cos(theta) * h,
        size: wm.fontSize,
        font: ctx.bold,
        color: hexToRgb(wm.color),
        opacity: wm.opacity,
        rotate: degrees(rotation + wm.angle),
      });
    }
  }

  const md = edits.metadata;
  if (md) {
    out.setTitle(md.title);
    out.setAuthor(md.author);
    out.setSubject(md.subject);
    out.setKeywords(
      md.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    );
  }
  out.setProducer('PDF-Werkstatt');
  out.setModificationDate(new Date());

  pruneOrphanFields(
    out,
    outPages.map((p) => p.page),
  );

  // Ohne Formularfelder braucht es auch kein leeres AcroForm mehr.
  if (out.getForm().getFields().length === 0) out.catalog.delete(PDFName.of('AcroForm'));

  return out.save({ useObjectStreams: true });
}
