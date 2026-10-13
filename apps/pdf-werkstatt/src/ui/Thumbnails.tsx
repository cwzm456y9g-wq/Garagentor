import { useEffect, useRef, useState } from 'react';
import type { PageRef, Source } from '../core/types';
import { displayDims, renderPage, type PageBase } from './pdfjs';

const THUMB_WIDTH = 120;

interface Props {
  pages: PageRef[];
  sources: Map<string, Source>;
  bases: Map<string, PageBase>;
  selected: Set<string>;
  current: string | null;
  onSelect: (key: string, mode: 'single' | 'toggle' | 'range') => void;
  onOpen: (key: string) => void;
  onMove: (beforeKey: string | null) => void;
}

/** Miniaturen aller Seiten: auswählen, anspringen und per Ziehen umsortieren. */
export function Thumbnails({
  pages,
  sources,
  bases,
  selected,
  current,
  onSelect,
  onOpen,
  onMove,
}: Props) {
  const [dropBefore, setDropBefore] = useState<string | null | undefined>(undefined);
  return (
    <div
      className="thumbs"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('application/x-seite')) return;
        e.preventDefault();
        if (e.target === e.currentTarget) setDropBefore(null);
      }}
      onDragLeave={(e) => {
        if (e.target === e.currentTarget) setDropBefore(undefined);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes('application/x-seite')) return;
        e.preventDefault();
        if (dropBefore !== undefined) onMove(dropBefore);
        setDropBefore(undefined);
      }}
    >
      {pages.map((p, i) => {
        const base = bases.get(p.key);
        return (
          <div
            key={p.key}
            className={`thumb${selected.has(p.key) ? ' selected' : ''}${current === p.key ? ' current' : ''}${dropBefore === p.key ? ' drop-before' : ''}`}
            draggable
            onDragStart={(e) => {
              if (!selected.has(p.key)) onSelect(p.key, 'single');
              e.dataTransfer.setData('application/x-seite', p.key);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('application/x-seite')) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              const after = e.clientY > r.top + r.height / 2;
              setDropBefore(after ? (pages[i + 1]?.key ?? null) : p.key);
            }}
            onClick={(e) => {
              onSelect(p.key, e.shiftKey ? 'range' : e.ctrlKey || e.metaKey ? 'toggle' : 'single');
              onOpen(p.key);
            }}
            title="Klicken: anspringen · Strg/Umschalt: mehrere wählen · Ziehen: verschieben"
          >
            {base ? (
              <Thumb
                pageRef={p}
                source={p.sourceId ? (sources.get(p.sourceId) ?? null) : null}
                base={base}
              />
            ) : (
              <div
                className="thumb-page"
                style={{ width: THUMB_WIDTH, height: THUMB_WIDTH * 1.41 }}
              />
            )}
            <span className="thumb-number">{i + 1}</span>
          </div>
        );
      })}
      {dropBefore === null ? <div className="drop-end" /> : null}
    </div>
  );
}

function Thumb({
  pageRef,
  source,
  base,
}: {
  pageRef: PageRef;
  source: Source | null;
  base: PageBase;
}) {
  const dims = displayDims(base, pageRef);
  const scale = THUMB_WIDTH / Math.max(dims.width, dims.height);
  const ref = useRef<HTMLCanvasElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), {
      rootMargin: '400px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !source || !ref.current) return;
    const ctrl = new AbortController();
    renderPage(ref.current, source, pageRef, scale, ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [visible, source, pageRef, scale]);

  return (
    <div
      ref={holder}
      className="thumb-page"
      style={{ width: dims.width * scale, height: dims.height * scale }}
    >
      {source ? <canvas ref={ref} style={{ width: '100%', height: '100%' }} /> : null}
    </div>
  );
}
