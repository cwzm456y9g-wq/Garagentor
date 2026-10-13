import type { Annotation, Box, Point } from '../core/types';

export type Tool =
  | 'select'
  | 'text'
  | 'highlight'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'ink'
  | 'whiteout'
  | 'note'
  | 'redact'
  | 'place';

export interface ToolOptions {
  color: string;
  strokeWidth: number;
  fontSize: number;
  bold: boolean;
  fill: boolean;
}

/** Etwas, das mit dem nächsten Klick auf eine Seite gesetzt wird. */
export type Pending =
  | { kind: 'image'; dataUrl: string; aspect: number; label: string }
  | { kind: 'stamp'; text: string; color: string }
  | null;

export const TOOLS: { id: Tool; label: string; icon: string; hint: string }[] = [
  {
    id: 'select',
    label: 'Auswählen',
    icon: '↖',
    hint: 'Markierungen auswählen, verschieben, Größe ändern (V)',
  },
  { id: 'text', label: 'Text', icon: 'T', hint: 'Text auf die Seite schreiben (T)' },
  { id: 'highlight', label: 'Hervorheben', icon: '▮', hint: 'Bereich farbig hervorheben (H)' },
  { id: 'rect', label: 'Rechteck', icon: '▭', hint: 'Rechteck zeichnen (R)' },
  { id: 'ellipse', label: 'Ellipse', icon: '◯', hint: 'Ellipse zeichnen (E)' },
  { id: 'line', label: 'Linie', icon: '╱', hint: 'Linie zeichnen (L)' },
  { id: 'arrow', label: 'Pfeil', icon: '↗', hint: 'Pfeil zeichnen (A)' },
  { id: 'ink', label: 'Freihand', icon: '✎', hint: 'Freihand zeichnen (F)' },
  { id: 'note', label: 'Notiz', icon: '🗨', hint: 'Kommentar anheften (N)' },
  { id: 'whiteout', label: 'Abdecken', icon: '◻', hint: 'Bereich weiß überdecken (W)' },
  { id: 'redact', label: 'Schwärzen', icon: '■', hint: 'Inhalt endgültig entfernen (S)' },
];

export const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  t: 'text',
  h: 'highlight',
  r: 'rect',
  e: 'ellipse',
  l: 'line',
  a: 'arrow',
  f: 'ink',
  n: 'note',
  w: 'whiteout',
  s: 'redact',
};

export const COLORS = [
  '#111827',
  '#dc2626',
  '#ea580c',
  '#facc15',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#ffffff',
];

const clampBox = (b: Box): Box => ({
  w: b.w,
  h: b.h,
  x: Math.min(Math.max(b.x, 0), 1 - b.w),
  y: Math.min(Math.max(b.y, 0), 1 - b.h),
});

export function moveAnnotation(a: Annotation, dx: number, dy: number): Annotation {
  const mv = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  switch (a.kind) {
    case 'ink':
      return { ...a, points: a.points.map(mv) };
    case 'line':
      return { ...a, from: mv(a.from), to: mv(a.to) };
    default:
      return { ...a, box: clampBox({ ...a.box, x: a.box.x + dx, y: a.box.y + dy }) };
  }
}

export function resizeAnnotation(
  a: Annotation,
  dx: number,
  dy: number,
  keepAspect: boolean,
): Annotation {
  if (a.kind === 'line') return { ...a, to: { x: a.to.x + dx, y: a.to.y + dy } };
  if (a.kind === 'ink' || a.kind === 'note') return a;
  let w = Math.max(0.01, Math.min(1 - a.box.x, a.box.w + dx));
  let h = Math.max(0.005, Math.min(1 - a.box.y, a.box.h + dy));
  if (keepAspect) {
    const ratio = a.box.h / a.box.w;
    h = w * ratio;
    if (a.box.y + h > 1) {
      h = 1 - a.box.y;
      w = h / ratio;
    }
  }
  return { ...a, box: { ...a.box, w, h } };
}

export const annotationLabel: Record<Annotation['kind'], string> = {
  text: 'Text',
  highlight: 'Hervorhebung',
  rect: 'Rechteck',
  ellipse: 'Ellipse',
  line: 'Linie',
  whiteout: 'Abdeckung',
  ink: 'Freihand',
  image: 'Bild',
  stamp: 'Stempel',
  note: 'Notiz',
  redact: 'Schwärzung',
};
