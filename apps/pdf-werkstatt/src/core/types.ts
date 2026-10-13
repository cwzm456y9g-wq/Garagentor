/**
 * Datenmodell der PDF-Werkstatt.
 *
 * Ein geöffnetes Dokument wird nie direkt verändert. Die Werkstatt merkt sich
 * nur, welche Seiten aus welchen Quellen in welcher Reihenfolge und Drehung
 * gewünscht sind und was darauf gezeichnet werden soll. Erst beim Speichern
 * entsteht daraus mit `assemble` eine neue Datei.
 */

/** Eine geöffnete Datei (PDF oder in ein PDF umgewandelte Bilder). */
export interface Source {
  id: string;
  name: string;
  bytes: Uint8Array;
}

export type Rotation = 0 | 90 | 180 | 270;

/** Eine Seite in der aktuellen Zusammenstellung. */
export interface PageRef {
  /** Eindeutig je Seite der Zusammenstellung, bleibt beim Verschieben gleich. */
  key: string;
  /** Quelle der Seite; fehlt bei einer eingefügten leeren Seite. */
  sourceId: string | null;
  pageIndex: number;
  /** Zusätzliche Drehung im Uhrzeigersinn, zur eigenen Drehung der Seite. */
  rotation: Rotation;
  /** Größe einer leeren Seite in Punkt (1/72 Zoll). */
  blankSize?: { width: number; height: number };
}

/**
 * Rechteck in Bruchteilen der Seite, wie sie angezeigt wird (also nach der
 * Drehung): x/y von links oben, Breite und Höhe jeweils 0–1.
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Farbe als #rrggbb. */
export type Color = string;

interface AnnotationBase {
  id: string;
  pageKey: string;
}

export type Annotation = AnnotationBase &
  (
    | { kind: 'text'; box: Box; text: string; fontSize: number; color: Color; bold: boolean }
    | { kind: 'highlight'; box: Box; color: Color }
    | { kind: 'rect'; box: Box; color: Color; strokeWidth: number; fill: boolean }
    | { kind: 'ellipse'; box: Box; color: Color; strokeWidth: number }
    | { kind: 'line'; from: Point; to: Point; color: Color; strokeWidth: number; arrow: boolean }
    | { kind: 'whiteout'; box: Box }
    | { kind: 'ink'; points: Point[]; color: Color; strokeWidth: number }
    | { kind: 'image'; box: Box; dataUrl: string }
    | { kind: 'stamp'; box: Box; text: string; color: Color }
    | { kind: 'note'; box: Box; text: string; color: Color }
    | { kind: 'redact'; box: Box }
  );

export type AnnotationKind = Annotation['kind'];

export type Position =
  'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface Watermark {
  text: string;
  fontSize: number;
  color: Color;
  /** 0–1 */
  opacity: number;
  /** Gegen den Uhrzeigersinn, in Grad. */
  angle: number;
}

export interface PageNumbers {
  /** Platzhalter: {n} Seitennummer, {total} Seitenzahl. */
  format: string;
  position: Position;
  fontSize: number;
  startAt: number;
  /** Mit führenden Nullen auf diese Stellenzahl auffüllen (Bates), 0 = aus. */
  padDigits: number;
  /** Erste Seite auslassen, z. B. ein Deckblatt. */
  skipFirst: boolean;
}

export interface HeaderFooter {
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
  fontSize: number;
}

export interface Metadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
}

/** Werte für Formularfelder, je Quelle und Feldname. */
export type FormValues = Record<string, Record<string, string | boolean>>;

/** Alles, was beim Speichern auf die Seiten angewendet wird. */
export interface Edits {
  annotations: Annotation[];
  watermark: Watermark | null;
  pageNumbers: PageNumbers | null;
  headerFooter: HeaderFooter | null;
  metadata: Metadata | null;
  formValues: FormValues;
  flattenForms: boolean;
  /**
   * Geschwärzte Seiten, als Bild der Seite mit den schwarzen Balken. Die
   * Oberfläche rendert das Bild; hier ersetzt es nur die Seite, damit der
   * verdeckte Text auch wirklich aus der Datei verschwindet.
   */
  rasterizedPages: Record<string, { png: Uint8Array }>;
}

export const emptyEdits = (): Edits => ({
  annotations: [],
  watermark: null,
  pageNumbers: null,
  headerFooter: null,
  metadata: null,
  formValues: {},
  flattenForms: false,
  rasterizedPages: {},
});
