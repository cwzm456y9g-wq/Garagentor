/**
 * Liest Seitenbereiche wie „1-3, 5, 8-“ (1-basiert) und gibt je Bereich die
 * 0-basierten Seitenindizes zurück. „8-“ reicht bis zur letzten Seite, „-3“
 * beginnt bei der ersten. Ein absteigender Bereich („5-2“) liefert die Seiten
 * rückwärts.
 */
export function parseRanges(input: string, pageCount: number): number[][] {
  const parts = input
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) throw new Error('Keine Seiten angegeben.');

  return parts.map((part) => {
    const m = /^(\d*)\s*(?:[-–]\s*(\d*))?$/.exec(part);
    if (!m || (m[1] === '' && m[2] === undefined)) {
      throw new Error(`„${part}“ ist kein gültiger Seitenbereich.`);
    }
    const isRange = m[2] !== undefined;
    const from = m[1] === '' ? 1 : Number(m[1]);
    const to = isRange ? (m[2] === '' ? pageCount : Number(m[2])) : from;
    for (const n of [from, to]) {
      if (n < 1 || n > pageCount) {
        throw new Error(`Seite ${n} gibt es nicht – das Dokument hat ${pageCount} Seiten.`);
      }
    }
    const step = from <= to ? 1 : -1;
    const pages: number[] = [];
    for (let n = from; n !== to + step; n += step) pages.push(n - 1);
    return pages;
  });
}

/** Teilt n Seiten in Stücke zu je `size` Seiten. */
export function chunkPages(pageCount: number, size: number): number[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error('Mindestens eine Seite je Teil.');
  const out: number[][] = [];
  for (let i = 0; i < pageCount; i += size) {
    out.push(Array.from({ length: Math.min(size, pageCount - i) }, (_, k) => i + k));
  }
  return out;
}
