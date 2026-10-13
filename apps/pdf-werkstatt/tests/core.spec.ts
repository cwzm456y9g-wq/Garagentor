import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { RedactionNotAppliedError, assemble, safeText, wrapText } from '../src/core/assemble';
import { readFormFields } from '../src/core/forms';
import { boxFromPoints, rotateAnnotation, toPdfPoint, toPdfRect } from '../src/core/geometry';
import { imagesToPdf } from '../src/core/images';
import { inspectPdf } from '../src/core/inspect';
import { chunkPages, parseRanges } from '../src/core/ranges';
import { emptyEdits, type Annotation, type PageRef, type Source } from '../src/core/types';

// 1×1 Pixel, rot.
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

async function makePdf(
  sizes: [number, number][],
  opts: { rotate?: number; form?: boolean; title?: string } = {},
) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  sizes.forEach(([w, h], i) => {
    const page = doc.addPage([w, h]);
    page.drawText(`Seite ${i + 1}`, { x: 20, y: 20, size: 12, font });
    if (opts.rotate) page.setRotation(degrees(opts.rotate));
  });
  if (opts.form) {
    const form = doc.getForm();
    const name = form.createTextField('name');
    name.addToPage(doc.getPage(0), { x: 50, y: 50, width: 200, height: 20 });
    const ok = form.createCheckBox('ok');
    ok.addToPage(doc.getPage(0), { x: 50, y: 100, width: 15, height: 15 });
    const color = form.createDropdown('farbe');
    color.addOptions(['Rot', 'Grün']);
    color.addToPage(doc.getPage(0), { x: 50, y: 150, width: 100, height: 20 });
  }
  if (opts.title) doc.setTitle(opts.title);
  return doc.save();
}

const ref = (
  sourceId: string | null,
  pageIndex: number,
  extra: Partial<PageRef> = {},
): PageRef => ({
  key: `${sourceId}-${pageIndex}-${Math.random()}`,
  sourceId,
  pageIndex,
  rotation: 0,
  ...extra,
});

describe('Seitenbereiche', () => {
  it('liest Einzelseiten, Bereiche und offene Enden', () => {
    expect(parseRanges('1-3, 5, 8-', 10)).toEqual([[0, 1, 2], [4], [7, 8, 9]]);
    expect(parseRanges('-2', 5)).toEqual([[0, 1]]);
    expect(parseRanges('3-1', 5)).toEqual([[2, 1, 0]]);
  });

  it('meldet Seiten außerhalb des Dokuments und Unsinn', () => {
    expect(() => parseRanges('11', 10)).toThrow(/10 Seiten/);
    expect(() => parseRanges('abc', 10)).toThrow(/gültiger/);
    expect(() => parseRanges(' ', 10)).toThrow(/Keine Seiten/);
  });

  it('teilt in gleich große Stücke', () => {
    expect(chunkPages(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
  });
});

describe('Koordinaten', () => {
  const g = { x0: 0, y0: 0, width: 200, height: 100 };

  it('bildet die Ecken bei jeder Drehung auf die richtigen PDF-Ecken ab', () => {
    // Angezeigt oben links liegt bei 0° oben links, bei 90° unten links usw.
    expect(toPdfPoint({ x: 0, y: 0 }, { ...g, rotation: 0 })).toEqual({ x: 0, y: 100 });
    expect(toPdfPoint({ x: 0, y: 0 }, { ...g, rotation: 90 })).toEqual({ x: 0, y: 0 });
    expect(toPdfPoint({ x: 0, y: 0 }, { ...g, rotation: 180 })).toEqual({ x: 200, y: 0 });
    expect(toPdfPoint({ x: 0, y: 0 }, { ...g, rotation: 270 })).toEqual({ x: 200, y: 100 });
    // Und angezeigt oben rechts.
    expect(toPdfPoint({ x: 1, y: 0 }, { ...g, rotation: 90 })).toEqual({ x: 0, y: 100 });
  });

  it('berücksichtigt den Versatz der CropBox', () => {
    expect(
      toPdfPoint({ x: 0.5, y: 0.5 }, { x0: 10, y0: 20, width: 100, height: 100, rotation: 0 }),
    ).toEqual({
      x: 60,
      y: 70,
    });
  });

  it('rechnet Rechtecke in angezeigte Maße um', () => {
    const r = toPdfRect({ x: 0, y: 0, w: 0.5, h: 0.5 }, { ...g, rotation: 90 });
    // Angezeigt ist die Seite 100 breit und 200 hoch.
    expect(r).toMatchObject({ width: 50, height: 100, rotate: 90 });
  });

  it('dreht Markierungen mit der Seite', () => {
    const a: Annotation = {
      id: 'a',
      pageKey: 'p',
      kind: 'whiteout',
      box: { x: 0, y: 0, w: 0.2, h: 0.1 },
    };
    const turned = rotateAnnotation(a, 90);
    expect(turned).toMatchObject({ box: { x: 0.9, y: 0, w: 0.1, h: 0.2 } });
    const back = rotateAnnotation(rotateAnnotation(turned, 90), 180);
    if (back.kind !== 'whiteout') throw new Error('Art geändert');
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(back.box[k]).toBeCloseTo(a.box[k]);
  });

  it('baut Rechtecke aus beliebigen Ecken und begrenzt sie auf die Seite', () => {
    expect(boxFromPoints({ x: 0.5, y: 0.8 }, { x: 1.2, y: 0.2 })).toEqual({
      x: 0.5,
      y: 0.2,
      w: 0.5,
      h: 0.6000000000000001,
    });
  });
});

describe('Text', () => {
  it('ersetzt Zeichen, die die Standardschrift nicht kann', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(safeText(font, 'Größe 5 € – 日本')).toBe('Größe 5 € – ??');
  });

  it('bricht lange Zeilen um und behält Absätze', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapText(font, 'eins zwei drei vier fünf\nsechs', 10, 50);
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.at(-1)).toBe('sechs');
    for (const l of lines) expect(font.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(50);
  });
});

describe('Zusammenstellen', () => {
  it('fügt Dokumente zusammen, ordnet um, dreht und fügt leere Seiten ein', async () => {
    const a: Source = {
      id: 'a',
      name: 'a.pdf',
      bytes: await makePdf(
        [
          [100, 200],
          [110, 200],
        ],
        { title: 'A' },
      ),
    };
    const b: Source = {
      id: 'b',
      name: 'b.pdf',
      bytes: await makePdf([[300, 400]], { rotate: 90 }),
    };
    const bytes = await assemble(
      [a, b],
      [
        ref('a', 1),
        ref('b', 0, { rotation: 90 }),
        ref(null, 0, { blankSize: { width: 50, height: 60 } }),
        ref('a', 0, { rotation: 270 }),
        ref('a', 1),
      ],
      emptyEdits(),
    );
    const out = await PDFDocument.load(bytes, { updateMetadata: false });
    const pages = out.getPages();
    expect(pages.map((p) => [p.getWidth(), p.getHeight()])).toEqual([
      [110, 200],
      [300, 400],
      [50, 60],
      [100, 200],
      [110, 200],
    ]);
    expect(pages.map((p) => p.getRotation().angle)).toEqual([0, 180, 0, 270, 0]);
    // Die Eigenschaften der ersten Quelle bleiben erhalten.
    expect(out.getTitle()).toBe('A');
    expect(out.getProducer()).toBe('PDF-Werkstatt');
  });

  it('zeichnet alle Arten von Markierungen auf gedrehte Seiten', async () => {
    const a: Source = {
      id: 'a',
      name: 'a.pdf',
      bytes: await makePdf([[200, 300]], { rotate: 90 }),
    };
    const page = ref('a', 0, { rotation: 90 });
    const box = { x: 0.1, y: 0.1, w: 0.3, h: 0.2 };
    const base = { pageKey: page.key };
    const annotations: Annotation[] = [
      {
        ...base,
        id: '1',
        kind: 'text',
        box,
        text: 'Hallo Welt\nzweite Zeile',
        fontSize: 12,
        color: '#112233',
        bold: true,
      },
      { ...base, id: '2', kind: 'highlight', box, color: '#ffff00' },
      { ...base, id: '3', kind: 'rect', box, color: '#ff0000', strokeWidth: 2, fill: true },
      { ...base, id: '4', kind: 'ellipse', box, color: '#00ff00', strokeWidth: 1 },
      {
        ...base,
        id: '5',
        kind: 'line',
        from: { x: 0, y: 0 },
        to: { x: 1, y: 1 },
        color: '#000000',
        strokeWidth: 2,
        arrow: true,
      },
      { ...base, id: '6', kind: 'whiteout', box },
      {
        ...base,
        id: '7',
        kind: 'ink',
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.2, y: 0.3 },
        ],
        color: '#0000ff',
        strokeWidth: 3,
      },
      {
        ...base,
        id: '8',
        kind: 'image',
        box,
        dataUrl: `data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`,
      },
      { ...base, id: '9', kind: 'stamp', box, text: 'Genehmigt', color: '#15803d' },
      { ...base, id: '10', kind: 'note', box, text: 'Bitte prüfen', color: '#facc15' },
    ];
    const edits = {
      ...emptyEdits(),
      annotations,
      watermark: { text: 'ENTWURF', fontSize: 40, color: '#888888', opacity: 0.3, angle: 45 },
      pageNumbers: {
        format: 'Seite {n} von {total}',
        position: 'bottom-center' as const,
        fontSize: 9,
        startAt: 1,
        padDigits: 0,
        skipFirst: false,
      },
      headerFooter: {
        headerLeft: 'Firma',
        headerCenter: '',
        headerRight: '{date}',
        footerLeft: '',
        footerCenter: '',
        footerRight: '{n}/{total}',
        fontSize: 8,
      },
      metadata: { title: 'Titel', author: 'Autor', subject: 'Betreff', keywords: 'a, b' },
    };
    const out = await PDFDocument.load(await assemble([a], [page], edits));
    expect(out.getPage(0).getRotation().angle).toBe(180);
    expect(out.getTitle()).toBe('Titel');
    expect(out.getAuthor()).toBe('Autor');
    expect(out.getKeywords()).toBe('a b');
    // Die Notiz ist ein echter PDF-Kommentar.
    expect(out.getPage(0).node.Annots()?.size()).toBe(1);
  });

  it('verweigert das Speichern, wenn eine Schwärzung nicht angewendet wurde', async () => {
    const a: Source = { id: 'a', name: 'a.pdf', bytes: await makePdf([[200, 300]]) };
    const page = ref('a', 0);
    const edits = {
      ...emptyEdits(),
      annotations: [
        { id: 'r', pageKey: page.key, kind: 'redact' as const, box: { x: 0, y: 0, w: 1, h: 1 } },
      ],
    };
    await expect(assemble([a], [page], edits)).rejects.toBeInstanceOf(RedactionNotAppliedError);
  });

  it('ersetzt geschwärzte Seiten durch ihr Bild, ohne den alten Text', async () => {
    const a: Source = {
      id: 'a',
      name: 'a.pdf',
      bytes: await makePdf([[200, 300]], { rotate: 90 }),
    };
    const page = ref('a', 0);
    const edits = {
      ...emptyEdits(),
      annotations: [
        { id: 'r', pageKey: page.key, kind: 'redact' as const, box: { x: 0, y: 0, w: 1, h: 1 } },
      ],
      rasterizedPages: { [page.key]: { png: PNG } },
    };
    const bytes = await assemble([a], [page], edits);
    const out = await PDFDocument.load(bytes);
    const p = out.getPage(0);
    // Die gedrehte Seite wird als aufrechtes Bild in angezeigter Größe ersetzt.
    expect([p.getWidth(), p.getHeight(), p.getRotation().angle]).toEqual([300, 200, 0]);
    expect(Buffer.from(bytes).toString('latin1')).not.toContain('Seite 1');
  });

  it('füllt Formulare aus und kann sie flach machen', async () => {
    const a: Source = {
      id: 'a',
      name: 'a.pdf',
      bytes: await makePdf([[400, 400]], { form: true }),
    };
    expect(await readFormFields(a.bytes)).toEqual([
      { name: 'name', type: 'text', value: '', multiline: false, readOnly: false },
      { name: 'ok', type: 'checkbox', value: false, readOnly: false },
      { name: 'farbe', type: 'choice', value: '', options: ['Rot', 'Grün'], readOnly: false },
    ]);
    const formValues = { a: { name: 'Müller', ok: true, farbe: 'Grün' } };
    const filled = await assemble([a], [ref('a', 0)], { ...emptyEdits(), formValues });
    expect(await readFormFields(filled)).toMatchObject([
      { name: 'name', value: 'Müller' },
      { name: 'ok', value: true },
      { name: 'farbe', value: 'Grün' },
    ]);
    const flat = await assemble([a], [ref('a', 0)], {
      ...emptyEdits(),
      formValues,
      flattenForms: true,
    });
    expect(await readFormFields(flat)).toEqual([]);
  });
});

describe('Formularfelder gelöschter Seiten', () => {
  it('entfernt Felder, deren Seite nicht mehr im Dokument ist', async () => {
    const a: Source = {
      id: 'a',
      name: 'a.pdf',
      bytes: await makePdf(
        [
          [400, 400],
          [400, 400],
        ],
        { form: true },
      ),
    };
    expect(await readFormFields(await assemble([a], [ref('a', 1)], emptyEdits()))).toEqual([]);
    expect(
      await readFormFields(await assemble([a], [ref('a', 0), ref('a', 1)], emptyEdits())),
    ).toHaveLength(3);
  });
});

describe('Bilder und Prüfung', () => {
  it('macht aus Bildern Seiten', async () => {
    const fit = await PDFDocument.load(await imagesToPdf([{ bytes: PNG, type: 'png' }]));
    expect(fit.getPage(0).getSize()).toEqual({ width: 0.75, height: 0.75 });
    const a4 = await PDFDocument.load(await imagesToPdf([{ bytes: PNG, type: 'png' }], 'a4'));
    expect(Math.round(a4.getPage(0).getHeight())).toBe(842);
  });

  it('liest Seitenzahl und Eigenschaften und erkennt kaputte Dateien', async () => {
    const info = await inspectPdf(
      await makePdf(
        [
          [10, 10],
          [10, 10],
        ],
        { title: 'T' },
      ),
      'x.pdf',
    );
    expect(info).toMatchObject({ pageCount: 2, metadata: { title: 'T' } });
    await expect(inspectPdf(new Uint8Array([1, 2, 3]), 'kaputt.pdf')).rejects.toThrow(
      /kaputt\.pdf/,
    );
  });
});
