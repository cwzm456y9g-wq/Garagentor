import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { boxFromPoints } from '../core/geometry';
import type { Annotation, PageRef, Point, Source } from '../core/types';
import { displayDims, renderPage, type PageBase } from './pdfjs';
import { addAnnotation, newId, updateAnnotation, type DocState } from './state';
import {
  moveAnnotation,
  resizeAnnotation,
  type Pending,
  type Tool,
  type ToolOptions,
} from './tools';

export interface PageInteraction {
  tool: Tool;
  options: ToolOptions;
  pending: Pending;
  selectedId: string | null;
  editingId: string | null;
  select: (id: string | null) => void;
  edit: (id: string | null) => void;
  setTool: (t: Tool) => void;
  clearPending: () => void;
  commit: (fn: (d: DocState) => DocState) => void;
  amend: (fn: (d: DocState) => DocState) => void;
}

interface Props {
  pageRef: PageRef;
  source: Source | null;
  base: PageBase;
  scale: number;
  number: number;
  annotations: Annotation[];
  interaction: PageInteraction;
  highlights?: { x: number; y: number; w: number; h: number }[];
}

type Drag =
  | { mode: 'move' | 'resize'; id: string; start: Point; original: Annotation; committed: boolean }
  | { mode: 'create'; start: Point; current: Point; points: Point[] };

const pct = (v: number) => `${v * 100}%`;

/** Eine Seite in der Hauptansicht: gerenderte Seite plus bearbeitbare Markierungen. */
export function PageView({
  pageRef,
  source,
  base,
  scale,
  number,
  annotations,
  interaction,
  highlights,
}: Props) {
  const dims = displayDims(base, pageRef);
  const width = dims.width * scale;
  const height = dims.height * scale;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), {
      rootMargin: '600px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !source || !canvasRef.current) return;
    const ctrl = new AbortController();
    renderPage(canvasRef.current, source, pageRef, scale, ctrl.signal)
      .then(() => setError(null))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    return () => ctrl.abort();
  }, [visible, source, pageRef, scale]);

  const { tool, options, pending, selectedId, editingId } = interaction;

  const toPoint = (e: PointerEvent): Point => {
    const r = overlayRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const create = (a: Annotation, keepTool = false) => {
    interaction.commit((d) => addAnnotation(d, a));
    interaction.select(a.id);
    if (!keepTool) interaction.setTool('select');
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const p = toPoint(e);
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-annotation]');
    if (tool === 'select' && !pending) {
      if (!target) {
        interaction.select(null);
        interaction.edit(null);
        return;
      }
      const id = target.dataset.annotation!;
      const a = annotations.find((x) => x.id === id);
      if (!a) return;
      interaction.select(id);
      if (editingId === id) return;
      const mode = (e.target as HTMLElement).dataset.handle ? 'resize' : 'move';
      overlayRef.current!.setPointerCapture(e.pointerId);
      setDrag({ mode, id, start: p, original: a, committed: false });
      e.preventDefault();
      return;
    }
    overlayRef.current!.setPointerCapture(e.pointerId);
    setDrag({ mode: 'create', start: p, current: p, points: [p] });
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const p = toPoint(e);
    if (drag.mode === 'create') {
      setDrag({ ...drag, current: p, points: tool === 'ink' ? [...drag.points, p] : drag.points });
      return;
    }
    const dx = p.x - drag.start.x;
    const dy = p.y - drag.start.y;
    if (!drag.committed && Math.hypot(dx * width, dy * height) < 3) return;
    const next =
      drag.mode === 'move'
        ? moveAnnotation(drag.original, dx, dy)
        : resizeAnnotation(drag.original, dx, dy, drag.original.kind === 'image' && !e.shiftKey);
    const apply = drag.committed ? interaction.amend : interaction.commit;
    apply((d) => updateAnnotation(d, drag.id, () => next));
    if (!drag.committed) setDrag({ ...drag, committed: true });
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    setDrag(null);
    if (drag.mode !== 'create') return;
    const end = toPoint(e);
    const box = boxFromPoints(drag.start, end);
    const tiny = box.w * width < 6 && box.h * height < 6;
    const base = { id: newId('m'), pageKey: pageRef.key };
    const clickBox = (wPt: number, hPt: number) => ({
      x: Math.min(drag.start.x, 1 - wPt / dims.width),
      y: Math.min(drag.start.y, 1 - hPt / dims.height),
      w: wPt / dims.width,
      h: hPt / dims.height,
    });

    if (pending) {
      if (pending.kind === 'image') {
        const wPt = tiny ? dims.width * 0.25 : box.w * dims.width;
        const b = tiny
          ? clickBox(wPt, wPt / pending.aspect)
          : { ...box, h: wPt / pending.aspect / dims.height };
        create({ ...base, kind: 'image', box: b, dataUrl: pending.dataUrl });
      } else {
        const b = tiny ? clickBox(dims.width * 0.3, dims.width * 0.09) : box;
        create({ ...base, kind: 'stamp', box: b, text: pending.text, color: pending.color });
      }
      interaction.clearPending();
      return;
    }

    switch (tool) {
      case 'text': {
        const b = tiny ? clickBox(dims.width * 0.35, options.fontSize * 1.2 * 2 + 4) : box;
        const a: Annotation = {
          ...base,
          kind: 'text',
          box: b,
          text: '',
          fontSize: options.fontSize,
          color: options.color,
          bold: options.bold,
        };
        create(a);
        interaction.edit(a.id);
        return;
      }
      case 'note': {
        const a: Annotation = {
          ...base,
          kind: 'note',
          box: clickBox(20, 20),
          text: '',
          color: '#facc15',
        };
        create(a);
        interaction.edit(a.id);
        return;
      }
      case 'ink':
        if (drag.points.length < 2) return;
        create(
          {
            ...base,
            kind: 'ink',
            points: drag.points,
            color: options.color,
            strokeWidth: options.strokeWidth,
          },
          true,
        );
        return;
      case 'line':
      case 'arrow':
        if (tiny) return;
        create(
          {
            ...base,
            kind: 'line',
            from: drag.start,
            to: end,
            color: options.color,
            strokeWidth: options.strokeWidth,
            arrow: tool === 'arrow',
          },
          true,
        );
        return;
      default:
        if (tiny) return;
    }
    switch (tool) {
      case 'highlight':
        create(
          {
            ...base,
            kind: 'highlight',
            box,
            color: options.color === '#111827' ? '#facc15' : options.color,
          },
          true,
        );
        return;
      case 'rect':
        create(
          {
            ...base,
            kind: 'rect',
            box,
            color: options.color,
            strokeWidth: options.strokeWidth,
            fill: options.fill,
          },
          true,
        );
        return;
      case 'ellipse':
        create(
          { ...base, kind: 'ellipse', box, color: options.color, strokeWidth: options.strokeWidth },
          true,
        );
        return;
      case 'whiteout':
        create({ ...base, kind: 'whiteout', box }, true);
        return;
      case 'redact':
        create({ ...base, kind: 'redact', box }, true);
        return;
    }
  };

  const draft = drag?.mode === 'create' ? drag : null;
  const cursor = tool === 'select' && !pending ? 'default' : tool === 'text' ? 'text' : 'crosshair';

  return (
    <div className="page-holder" ref={holderRef} id={`seite-${pageRef.key}`} data-key={pageRef.key}>
      <div className="page" style={{ width, height }}>
        {source ? (
          <canvas ref={canvasRef} className="page-canvas" style={{ width, height }} />
        ) : null}
        {error ? <div className="page-error">Seite lässt sich nicht anzeigen: {error}</div> : null}
        {highlights?.map((b, i) => (
          <div
            key={i}
            className="search-hit"
            style={{ left: pct(b.x), top: pct(b.y), width: pct(b.w), height: pct(b.h) }}
          />
        ))}
        <div
          ref={overlayRef}
          className="overlay"
          style={{ cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
        >
          <svg className="vector-layer" viewBox="0 0 1 1" preserveAspectRatio="none">
            {annotations.map((a) =>
              a.kind === 'ink' ? (
                <polyline
                  key={a.id}
                  data-annotation={a.id}
                  points={a.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={a.strokeWidth * scale}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={a.id === selectedId ? 'selected-vector' : ''}
                />
              ) : a.kind === 'line' ? (
                <g
                  key={a.id}
                  data-annotation={a.id}
                  className={a.id === selectedId ? 'selected-vector' : ''}
                >
                  <line
                    x1={a.from.x}
                    y1={a.from.y}
                    x2={a.to.x}
                    y2={a.to.y}
                    stroke="transparent"
                    strokeWidth={Math.max(12, a.strokeWidth * scale)}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={a.from.x}
                    y1={a.from.y}
                    x2={a.to.x}
                    y2={a.to.y}
                    stroke={a.color}
                    strokeWidth={a.strokeWidth * scale}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    markerEnd={a.arrow ? `url(#pfeil-${a.id})` : undefined}
                  />
                  {a.arrow ? (
                    <defs>
                      <marker
                        id={`pfeil-${a.id}`}
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto-start-reverse"
                        markerUnits="strokeWidth"
                      >
                        <path
                          d="M 0 0 L 10 5 L 0 10"
                          fill="none"
                          stroke={a.color}
                          strokeWidth="1.6"
                        />
                      </marker>
                    </defs>
                  ) : null}
                </g>
              ) : null,
            )}
            {draft && tool === 'ink' ? (
              <polyline
                points={draft.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={options.color}
                strokeWidth={options.strokeWidth * scale}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
              />
            ) : null}
            {draft && (tool === 'line' || tool === 'arrow') ? (
              <line
                x1={draft.start.x}
                y1={draft.start.y}
                x2={draft.current.x}
                y2={draft.current.y}
                stroke={options.color}
                strokeWidth={options.strokeWidth * scale}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
          {annotations.map((a) =>
            'box' in a ? (
              <BoxAnnotation
                key={a.id}
                a={a}
                scale={scale}
                pageHeightPt={dims.height}
                selected={a.id === selectedId}
                editing={a.id === editingId}
                interaction={interaction}
              />
            ) : null,
          )}
          {selectedId && annotations.some((a) => a.id === selectedId && a.kind === 'line')
            ? (() => {
                const a = annotations.find((x) => x.id === selectedId) as Extract<
                  Annotation,
                  { kind: 'line' }
                >;
                return (
                  <div
                    className="handle line-handle"
                    data-annotation={a.id}
                    data-handle="1"
                    style={{ left: pct(a.to.x), top: pct(a.to.y) }}
                  />
                );
              })()
            : null}
          {draft && !['ink', 'line', 'arrow'].includes(tool) && !(tool === 'select' && !pending) ? (
            <div
              className={`draft draft-${pending ? 'place' : tool}`}
              style={boxStyle(boxFromPoints(draft.start, draft.current))}
            />
          ) : null}
        </div>
      </div>
      <div className="page-number">{number}</div>
    </div>
  );
}

const boxStyle = (b: { x: number; y: number; w: number; h: number }): CSSProperties => ({
  left: pct(b.x),
  top: pct(b.y),
  width: pct(b.w),
  height: pct(b.h),
});

function BoxAnnotation({
  a,
  scale,
  pageHeightPt,
  selected,
  editing,
  interaction,
}: {
  a: Extract<Annotation, { box: unknown }>;
  scale: number;
  pageHeightPt: number;
  selected: boolean;
  editing: boolean;
  interaction: PageInteraction;
}) {
  const style = boxStyle(a.box);
  const cls = `annotation annotation-${a.kind}${selected ? ' selected' : ''}`;
  const startedEdit = useRef(false);
  useEffect(() => {
    if (!editing) startedEdit.current = false;
  }, [editing]);

  const setText = (text: string) => {
    const fn = (d: DocState) =>
      updateAnnotation(d, a.id, (x) =>
        x.kind === 'text' || x.kind === 'note' ? { ...x, text } : x,
      );
    if (startedEdit.current) interaction.amend(fn);
    else {
      interaction.commit(fn);
      startedEdit.current = true;
    }
  };

  const handle =
    selected && a.kind !== 'note' ? (
      <div className="handle" data-handle="1" data-annotation={a.id} />
    ) : null;
  const onDoubleClick = () => {
    if (a.kind === 'text' || a.kind === 'note') interaction.edit(a.id);
  };

  switch (a.kind) {
    case 'text': {
      const textStyle: CSSProperties = {
        fontSize: a.fontSize * scale,
        color: a.color,
        fontWeight: a.bold ? 700 : 400,
        padding: 2 * scale,
      };
      // Wächst der Text über das Feld hinaus, wächst das Feld mit.
      const grow = (el: HTMLTextAreaElement | null) => {
        if (!el) return;
        const needed = el.scrollHeight / scale / pageHeightPt;
        if (needed > a.box.h + 0.001) {
          interaction.amend((d) =>
            updateAnnotation(d, a.id, (x) =>
              'box' in x ? { ...x, box: { ...x.box, h: Math.min(needed, 1 - x.box.y) } } : x,
            ),
          );
        }
      };
      return (
        <div className={cls} style={style} data-annotation={a.id} onDoubleClick={onDoubleClick}>
          {editing ? (
            <textarea
              autoFocus
              className="text-editor"
              style={textStyle}
              value={a.text}
              placeholder="Text eingeben …"
              ref={grow}
              onChange={(e) => {
                setText(e.target.value);
                grow(e.target);
              }}
              onBlur={() => interaction.edit(null)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
                e.stopPropagation();
              }}
            />
          ) : (
            <div className="text-view" style={textStyle}>
              {a.text || <span className="placeholder">Text</span>}
            </div>
          )}
          {handle}
        </div>
      );
    }
    case 'note':
      return (
        <div
          className={cls}
          style={style}
          data-annotation={a.id}
          onDoubleClick={onDoubleClick}
          title={a.text || 'Notiz'}
        >
          <div className="note-icon" style={{ background: a.color }}>
            🗨
          </div>
          {editing || selected ? (
            <div className="note-popup" onPointerDown={(e) => e.stopPropagation()}>
              <textarea
                autoFocus={editing}
                value={a.text}
                placeholder="Kommentar …"
                onChange={(e) => setText(e.target.value)}
                onBlur={() => interaction.edit(null)}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          ) : null}
        </div>
      );
    case 'highlight':
      return (
        <div className={cls} style={{ ...style, background: a.color }} data-annotation={a.id}>
          {handle}
        </div>
      );
    case 'rect':
      return (
        <div
          className={cls}
          style={{
            ...style,
            border: `${a.strokeWidth * scale}px solid ${a.color}`,
            background: a.fill ? `${a.color}40` : 'transparent',
          }}
          data-annotation={a.id}
        >
          {handle}
        </div>
      );
    case 'ellipse':
      return (
        <div
          className={cls}
          style={{
            ...style,
            border: `${a.strokeWidth * scale}px solid ${a.color}`,
            borderRadius: '50%',
          }}
          data-annotation={a.id}
        >
          {handle}
        </div>
      );
    case 'whiteout':
      return (
        <div className={cls} style={style} data-annotation={a.id}>
          {handle}
        </div>
      );
    case 'redact':
      return (
        <div
          className={cls}
          style={style}
          data-annotation={a.id}
          title="Wird beim Speichern endgültig geschwärzt"
        >
          {handle}
        </div>
      );
    case 'image':
      return (
        <div className={cls} style={style} data-annotation={a.id}>
          <img src={a.dataUrl} alt="" draggable={false} />
          {handle}
        </div>
      );
    case 'stamp':
      return (
        <div
          className={cls}
          style={{ ...style, color: a.color, borderColor: a.color }}
          data-annotation={a.id}
        >
          <svg
            viewBox={`0 0 ${Math.max(a.text.length, 1) * 11} 20`}
            preserveAspectRatio="xMidYMid meet"
          >
            <text
              x="50%"
              y="15"
              textAnchor="middle"
              fill={a.color}
              fontWeight="700"
              fontSize="16"
              fontFamily="Helvetica, Arial, sans-serif"
            >
              {a.text.toUpperCase()}
            </text>
          </svg>
          {handle}
        </div>
      );
  }
}
