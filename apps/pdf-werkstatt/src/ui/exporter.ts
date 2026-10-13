import { assemble } from '../core/assemble';
import { emptyEdits, type Edits, type PageRef } from '../core/types';
import { forgetPdf, rasterizePage } from './pdfjs';
import { newId, type DocState } from './state';

/** Auflösung, mit der geschwärzte Seiten als Bild neu entstehen. */
const REDACTION_DPI = 200;

/**
 * Baut aus dem Zustand die PDF-Datei, optional nur für einen Teil der Seiten.
 * Seiten mit Schwärzungen werden dafür vorher als Bild gerendert.
 */
export async function buildPdf(doc: DocState, pages: PageRef[] = doc.pages): Promise<Uint8Array> {
  const keys = new Set(pages.map((p) => p.key));
  const byId = new Map(doc.sources.map((s) => [s.id, s]));
  const rasterizedPages: Edits['rasterizedPages'] = {};
  for (const ref of pages) {
    const boxes = doc.edits.annotations
      .filter((a) => a.pageKey === ref.key && a.kind === 'redact')
      .map((a) => ('box' in a ? a.box : null))
      .filter((b) => b !== null);
    if (boxes.length === 0) continue;
    let blob: Blob;
    if (ref.sourceId && byId.has(ref.sourceId)) {
      // Erst die Seite mit ausgefüllten, festen Formularwerten erzeugen,
      // damit diese im Bild der geschwärzten Seite nicht verloren gehen.
      const flat = {
        id: newId('schwaerzung'),
        name: 'schwaerzung.pdf',
        bytes: await assemble(doc.sources, [{ ...ref, rotation: 0 }], {
          ...emptyEdits(),
          formValues: doc.edits.formValues,
          flattenForms: true,
        }),
      };
      try {
        blob = await rasterizePage(
          flat,
          { ...ref, sourceId: flat.id, pageIndex: 0 },
          REDACTION_DPI,
          boxes,
        );
      } finally {
        forgetPdf(flat.id);
      }
    } else {
      blob = await rasterizePage(null, ref, REDACTION_DPI, boxes);
    }
    rasterizedPages[ref.key] = { png: new Uint8Array(await blob.arrayBuffer()) };
  }
  return assemble(doc.sources, pages, {
    ...doc.edits,
    annotations: doc.edits.annotations.filter((a) => keys.has(a.pageKey)),
    rasterizedPages,
  });
}
