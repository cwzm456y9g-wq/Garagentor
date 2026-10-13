import type { Annotation, Box, Point, Rotation } from './types';

/** Seitenmaße in PDF-Punkten, ohne Drehung. */
export interface PageGeometry {
  /** Linke untere Ecke des sichtbaren Bereichs (CropBox). */
  x0: number;
  y0: number;
  width: number;
  height: number;
  /** Gesamtdrehung, mit der die Seite angezeigt wird. */
  rotation: Rotation;
}

export const normalizeRotation = (deg: number): Rotation =>
  ((((Math.round(deg / 90) * 90) % 360) + 360) % 360) as Rotation;

/** Größe der Seite, wie sie angezeigt wird. */
export const displaySize = (g: PageGeometry): { width: number; height: number } =>
  g.rotation === 90 || g.rotation === 270
    ? { width: g.height, height: g.width }
    : { width: g.width, height: g.height };

/**
 * Rechnet einen Punkt der angezeigten Seite (Bruchteile, y nach unten) in
 * PDF-Koordinaten der ungedrehten Seite um (Punkt, y nach oben).
 */
export function toPdfPoint(p: Point, g: PageGeometry): { x: number; y: number } {
  const { x0, y0, width: w, height: h } = g;
  switch (g.rotation) {
    case 90:
      return { x: x0 + p.y * w, y: y0 + p.x * h };
    case 180:
      return { x: x0 + (1 - p.x) * w, y: y0 + p.y * h };
    case 270:
      return { x: x0 + (1 - p.y) * w, y: y0 + (1 - p.x) * h };
    default:
      return { x: x0 + p.x * w, y: y0 + (1 - p.y) * h };
  }
}

/**
 * Rechteck der angezeigten Seite als Ankerpunkt, Maße und Drehwinkel für
 * pdf-lib. Der Anker ist die angezeigte linke untere Ecke; pdf-lib dreht um
 * ihn gegen den Uhrzeigersinn, was die Drehung der Seite genau aufhebt.
 */
export function toPdfRect(
  box: Box,
  g: PageGeometry,
): { x: number; y: number; width: number; height: number; rotate: number } {
  const anchor = toPdfPoint({ x: box.x, y: box.y + box.h }, g);
  const size = displaySize(g);
  return {
    x: anchor.x,
    y: anchor.y,
    width: box.w * size.width,
    height: box.h * size.height,
    rotate: g.rotation,
  };
}

const rotatePoint = (p: Point, turns: number): Point => {
  let { x, y } = p;
  for (let i = 0; i < turns; i++) [x, y] = [1 - y, x];
  return { x, y };
};

const rotateBox = (b: Box, turns: number): Box => {
  let box = b;
  for (let i = 0; i < turns; i++) box = { x: 1 - box.y - box.h, y: box.x, w: box.h, h: box.w };
  return box;
};

/**
 * Dreht eine Markierung mit, wenn ihre Seite um `delta` Grad im
 * Uhrzeigersinn gedreht wird. Texte bleiben dabei aufrecht lesbar.
 */
export function rotateAnnotation(a: Annotation, delta: number): Annotation {
  const turns = normalizeRotation(delta) / 90;
  if (turns === 0) return a;
  switch (a.kind) {
    case 'ink':
      return { ...a, points: a.points.map((p) => rotatePoint(p, turns)) };
    case 'line':
      return { ...a, from: rotatePoint(a.from, turns), to: rotatePoint(a.to, turns) };
    default:
      return { ...a, box: rotateBox(a.box, turns) };
  }
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Rechteck aus zwei beliebigen Eckpunkten, auf die Seite begrenzt. */
export function boxFromPoints(a: Point, b: Point): Box {
  const x1 = clamp01(Math.min(a.x, b.x));
  const y1 = clamp01(Math.min(a.y, b.y));
  const x2 = clamp01(Math.max(a.x, b.x));
  const y2 = clamp01(Math.max(a.y, b.y));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
