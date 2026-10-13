import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RedactionNotAppliedError } from '../core/assemble';
import type { ImagePageSize } from '../core/images';
import type { Annotation, PageRef } from '../core/types';
import { buildPdf } from './exporter';
import { ACCEPT, download, openFiles, printPdf } from './files';
import { PageView, type PageInteraction } from './PageView';
import {
  AnnotationInspector,
  CommentsPanel,
  DesignPanel,
  FormsPanel,
  PagesPanel,
  PropertiesPanel,
  SearchPanel,
  SignPanel,
  type PanelProps,
} from './panels';
import { PX_PER_PT, blankBase, displayDims, pageBase, type PageBase, type TextHit } from './pdfjs';
import {
  movePages,
  newId,
  removeAnnotation,
  rotatePages,
  useDocument,
  type DocState,
} from './state';
import { Thumbnails } from './Thumbnails';
import { COLORS, TOOLS, TOOL_KEYS, type Pending, type Tool, type ToolOptions } from './tools';

type PanelId = 'pages' | 'comments' | 'forms' | 'sign' | 'design' | 'search' | 'properties';

const PANELS: { id: PanelId; label: string; icon: string }[] = [
  { id: 'pages', label: 'Seiten', icon: '▤' },
  { id: 'comments', label: 'Kommentare', icon: '🗨' },
  { id: 'forms', label: 'Formular', icon: '☑' },
  { id: 'sign', label: 'Unterschrift & Stempel', icon: '✍' },
  { id: 'design', label: 'Wasserzeichen & Seitenzahlen', icon: '❖' },
  { id: 'search', label: 'Suchen & Text', icon: '🔍' },
  { id: 'properties', label: 'Eigenschaften', icon: 'ℹ' },
];

const ZOOMS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export function App() {
  const { doc, commit, amend, undo, redo, canUndo, canRedo, dirty, markSaved } = useDocument();
  const [tool, setTool] = useState<Tool>('select');
  const [options, setOptions] = useState<ToolOptions>({
    color: '#dc2626',
    strokeWidth: 2,
    fontSize: 12,
    bold: false,
    fill: false,
  });
  const [pending, setPending] = useState<Pending>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | 'width'>('width');
  const [panel, setPanel] = useState<PanelId | null>('pages');
  const [bases, setBases] = useState<Map<string, PageBase>>(new Map());
  const [status, setStatus] = useState<{ msg: string; kind: 'ok' | 'error' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [imageSize, setImageSize] = useState<ImagePageSize>('a4');
  const [searchHits, setSearchHits] = useState<TextHit[]>([]);
  const [viewerWidth, setViewerWidth] = useState(800);
  const fileInput = useRef<HTMLInputElement>(null);
  const viewer = useRef<HTMLDivElement>(null);
  const lastClicked = useRef<string | null>(null);

  const sources = useMemo(() => new Map(doc.sources.map((s) => [s.id, s])), [doc.sources]);

  const notify = useCallback(
    (msg: string, kind: 'ok' | 'error' = 'ok') => setStatus({ msg, kind }),
    [],
  );
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), status.kind === 'error' ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [status]);

  const run = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setBusy(label);
      try {
        await fn();
      } catch (err) {
        notify(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setBusy(null);
      }
    },
    [notify],
  );

  // Maße jeder Seite laden, damit die Ansicht vor dem Rendern ihre Größe kennt.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const missing = doc.pages.filter((p) => !bases.has(p.key));
      if (missing.length === 0) return;
      const next = new Map(bases);
      for (const p of missing) {
        const source = p.sourceId ? sources.get(p.sourceId) : undefined;
        next.set(p.key, source ? await pageBase(source, p.pageIndex) : blankBase(p));
      }
      if (alive) setBases(next);
    })();
    return () => {
      alive = false;
    };
  }, [doc.pages, sources, bases]);

  useEffect(() => {
    const el = viewer.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewerWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const widest = useMemo(() => {
    let w = 0;
    for (const p of doc.pages) {
      const b = bases.get(p.key);
      if (b) w = Math.max(w, displayDims(b, p).width);
    }
    return w || 595;
  }, [doc.pages, bases]);
  const scale = zoom === 'width' ? Math.max(0.2, (viewerWidth - 48) / widest) : zoom * PX_PER_PT;
  const zoomPercent = Math.round((scale / PX_PER_PT) * 100);

  const stepZoom = (dir: 1 | -1) => {
    const current = scale / PX_PER_PT;
    const next =
      dir > 0
        ? ZOOMS.find((z) => z > current + 0.01)
        : [...ZOOMS].reverse().find((z) => z < current - 0.01);
    if (next) setZoom(next);
  };

  // Aktuelle Seite = die, die am meisten im Bild ist.
  useEffect(() => {
    const el = viewer.current;
    if (!el) return;
    const onScroll = () => {
      const mid = el.getBoundingClientRect().top + el.clientHeight / 3;
      let best: string | null = null;
      for (const holder of el.querySelectorAll<HTMLElement>('.page-holder')) {
        const r = holder.getBoundingClientRect();
        if (r.top <= mid) best = holder.dataset.key ?? best;
        else break;
      }
      setCurrentKey(best ?? doc.pages[0]?.key ?? null);
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [doc.pages, scale]);

  const goTo = useCallback((key: string) => {
    document.getElementById(`seite-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const addFiles = useCallback(
    (files: File[]) =>
      run('Dateien werden geöffnet …', async () => {
        const opened = await openFiles(files, imageSize);
        if (opened.length === 0) return;
        commit((d): DocState => {
          const pages: PageRef[] = [...d.pages];
          for (const { source, info } of opened) {
            for (let i = 0; i < info.pageCount; i++) {
              pages.push({ key: newId('seite'), sourceId: source.id, pageIndex: i, rotation: 0 });
            }
          }
          const first = opened[0]!;
          const fresh = d.pages.length === 0;
          return {
            ...d,
            sources: [...d.sources, ...opened.map((o) => o.source)],
            pages,
            fileName: fresh ? first.source.name.replace(/(\.pdf)?$/i, '.pdf') : d.fileName,
            edits:
              fresh && !d.edits.metadata ? { ...d.edits, metadata: first.info.metadata } : d.edits,
          };
        });
        notify(`${opened.map((o) => o.source.name).join(', ')} geöffnet.`);
      }),
    [commit, imageSize, notify, run],
  );

  const save = useCallback(
    () =>
      run('PDF wird gespeichert …', async () => {
        try {
          const bytes = await buildPdf(doc);
          download(bytes, doc.fileName || 'dokument.pdf');
          markSaved();
          notify(`${doc.fileName} gespeichert (${(bytes.length / 1024).toFixed(0)} KB).`);
        } catch (err) {
          if (err instanceof RedactionNotAppliedError) throw err;
          throw new Error(
            `Speichern fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }),
    [doc, markSaved, notify, run],
  );

  const print = useCallback(
    () => run('Druck wird vorbereitet …', async () => printPdf(await buildPdf(doc))),
    [doc, run],
  );

  const selectedAnnotation = doc.edits.annotations.find((a) => a.id === selectedId) ?? null;

  // Tastenkürzel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest(
        'input, textarea, select, [contenteditable]',
      );
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (doc.pages.length) void save();
      } else if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        fileInput.current?.click();
      } else if (mod && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (doc.pages.length) void print();
      } else if (typing) {
        return;
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        commit((d) => removeAnnotation(d, selectedId));
        setSelectedId(null);
      } else if (e.key === 'Escape') {
        setPending(null);
        setTool('select');
        setSelectedId(null);
      } else if (mod && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        stepZoom(1);
      } else if (mod && e.key === '-') {
        e.preventDefault();
        stepZoom(-1);
      } else if (!mod && !e.altKey && TOOL_KEYS[e.key.toLowerCase()]) {
        setTool(TOOL_KEYS[e.key.toLowerCase()]!);
        setPending(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const interaction: PageInteraction = {
    tool,
    options,
    pending,
    selectedId,
    editingId,
    select: setSelectedId,
    edit: setEditingId,
    setTool,
    clearPending: () => {
      setPending(null);
      setStatus(null);
    },
    commit,
    amend,
  };

  const onSelectPage = (key: string, mode: 'single' | 'toggle' | 'range') => {
    if (mode === 'single') setSelectedPages(new Set([key]));
    else if (mode === 'toggle') {
      const next = new Set(selectedPages);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setSelectedPages(next);
    } else {
      const keys = doc.pages.map((p) => p.key);
      const a = keys.indexOf(lastClicked.current ?? key);
      const b = keys.indexOf(key);
      setSelectedPages(new Set(keys.slice(Math.min(a, b), Math.max(a, b) + 1)));
    }
    if (mode !== 'range') lastClicked.current = key;
  };

  const panelProps: PanelProps = {
    doc,
    commit,
    amend,
    selected: selectedPages,
    setSelected: setSelectedPages,
    currentKey,
    goTo,
    notify,
    run,
    setPending: (p) => {
      setPending(p);
      if (p) setTool('place');
    },
    setTool,
    setSearchHits,
    selectedAnnotation,
    selectAnnotation: setSelectedId,
    addFiles: () => fileInput.current?.click(),
  };

  const byPage = useMemo(() => {
    const m = new Map<string, Annotation[]>();
    for (const a of doc.edits.annotations) m.set(a.pageKey, [...(m.get(a.pageKey) ?? []), a]);
    return m;
  }, [doc.edits.annotations]);
  const hitsByPage = useMemo(() => {
    const m = new Map<string, TextHit['box'][]>();
    for (const h of searchHits) m.set(h.pageKey, [...(m.get(h.pageKey) ?? []), h.box]);
    return m;
  }, [searchHits]);

  const empty = doc.pages.length === 0;
  const currentIndex = currentKey ? doc.pages.findIndex((p) => p.key === currentKey) : -1;

  return (
    <div
      className={`app${dragOver ? ' drag-over' : ''}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.relatedTarget === null) setDragOver(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragOver(false);
        void addFiles([...e.dataTransfer.files]);
      }}
    >
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) void addFiles(files);
        }}
      />
      <header className="topbar">
        <div className="brand">
          <span className="logo">PDF</span> Werkstatt
        </div>
        <div className="group">
          <button onClick={() => fileInput.current?.click()} title="Öffnen (Strg+O)">
            📂 Öffnen
          </button>
          <button
            className="primary"
            disabled={empty}
            onClick={() => void save()}
            title="Speichern (Strg+S)"
          >
            💾 Speichern
          </button>
          <button disabled={empty} onClick={() => void print()} title="Drucken (Strg+P)">
            🖨 Drucken
          </button>
        </div>
        <div className="group">
          <button className="icon" disabled={!canUndo} onClick={undo} title="Rückgängig (Strg+Z)">
            ↶
          </button>
          <button className="icon" disabled={!canRedo} onClick={redo} title="Wiederholen (Strg+Y)">
            ↷
          </button>
        </div>
        <div className="group">
          <button
            className="icon"
            disabled={empty}
            onClick={() => stepZoom(-1)}
            title="Verkleinern"
          >
            −
          </button>
          <button
            className={`zoom-label${zoom === 'width' ? ' active' : ''}`}
            disabled={empty}
            onClick={() => setZoom(zoom === 'width' ? 1 : 'width')}
            title="Breite einpassen / 100 %"
          >
            {zoomPercent} %
          </button>
          <button className="icon" disabled={empty} onClick={() => stepZoom(1)} title="Vergrößern">
            ＋
          </button>
        </div>
        <div className="group">
          <button
            className="icon"
            disabled={!currentKey}
            title="Aktuelle Seite links drehen"
            onClick={() => currentKey && commit((d) => rotatePages(d, new Set([currentKey]), -90))}
          >
            ⟲
          </button>
          <button
            className="icon"
            disabled={!currentKey}
            title="Aktuelle Seite rechts drehen"
            onClick={() => currentKey && commit((d) => rotatePages(d, new Set([currentKey]), 90))}
          >
            ⟳
          </button>
        </div>
        {!empty ? (
          <div className="page-indicator">
            Seite{' '}
            <input
              type="number"
              min={1}
              max={doc.pages.length}
              value={currentIndex + 1 || 1}
              onChange={(e) => {
                const p = doc.pages[Number(e.target.value) - 1];
                if (p) goTo(p.key);
              }}
            />{' '}
            von {doc.pages.length}
          </div>
        ) : null}
        <div className="spacer" />
        {dirty ? (
          <span className="dirty" title="Ungespeicherte Änderungen">
            ● nicht gespeichert
          </span>
        ) : null}
      </header>

      <div className="toolbar">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool${tool === t.id && !pending ? ' active' : ''}`}
            title={t.hint}
            disabled={empty}
            onClick={() => {
              setTool(t.id);
              setPending(null);
            }}
          >
            <span className="tool-icon">{t.icon}</span>
            <span className="tool-label">{t.label}</span>
          </button>
        ))}
        <div className="divider" />
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch${options.color === c ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => setOptions({ ...options, color: c })}
              aria-label={`Farbe ${c}`}
            />
          ))}
          <input
            type="color"
            value={options.color}
            onChange={(e) => setOptions({ ...options, color: e.target.value })}
            title="Eigene Farbe"
          />
        </div>
        {tool === 'text' ? (
          <>
            <label className="inline">
              Größe
              <input
                type="number"
                min={4}
                max={144}
                value={options.fontSize}
                onChange={(e) => setOptions({ ...options, fontSize: Number(e.target.value) || 12 })}
              />
            </label>
            <label className="inline">
              <input
                type="checkbox"
                checked={options.bold}
                onChange={(e) => setOptions({ ...options, bold: e.target.checked })}
              />{' '}
              Fett
            </label>
          </>
        ) : null}
        {['rect', 'ellipse', 'line', 'arrow', 'ink'].includes(tool) ? (
          <label className="inline">
            Stärke
            <input
              type="range"
              min={0.5}
              max={12}
              step={0.5}
              value={options.strokeWidth}
              onChange={(e) => setOptions({ ...options, strokeWidth: Number(e.target.value) })}
            />
          </label>
        ) : null}
        {tool === 'rect' ? (
          <label className="inline">
            <input
              type="checkbox"
              checked={options.fill}
              onChange={(e) => setOptions({ ...options, fill: e.target.checked })}
            />{' '}
            Gefüllt
          </label>
        ) : null}
        {pending ? (
          <span className="pending">
            {pending.kind === 'image'
              ? `${pending.label} platzieren`
              : `Stempel „${pending.text}“ platzieren`}{' '}
            – auf die Seite klicken
            <button
              className="link"
              onClick={() => {
                setPending(null);
                setTool('select');
              }}
            >
              Abbrechen
            </button>
          </span>
        ) : null}
      </div>

      <div className="workspace">
        <aside className="sidebar">
          <Thumbnails
            pages={doc.pages}
            sources={sources}
            bases={bases}
            selected={selectedPages}
            current={currentKey}
            onSelect={onSelectPage}
            onOpen={goTo}
            onMove={(before) => commit((d) => movePages(d, selectedPages, before))}
          />
        </aside>

        <main className="viewer" ref={viewer}>
          {empty ? (
            <div className="welcome">
              <h1>PDF-Werkstatt</h1>
              <p>
                PDFs ansehen, kommentieren, ausfüllen, unterschreiben, zusammenfügen, teilen,
                schwärzen und mit Wasserzeichen oder Seitenzahlen versehen.
              </p>
              <p className="muted">
                Alles passiert in diesem Browser – Ihre Dateien werden nirgendwohin hochgeladen.
              </p>
              <button className="primary big" onClick={() => fileInput.current?.click()}>
                PDF oder Bilder öffnen
              </button>
              <p className="muted">oder Dateien hierher ziehen</p>
              <label className="inline">
                Bilder als Seiten
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value as ImagePageSize)}
                >
                  <option value="a4">auf A4 einpassen</option>
                  <option value="fit">in Originalgröße</option>
                </select>
              </label>
            </div>
          ) : (
            doc.pages.map((p, i) => {
              const base = bases.get(p.key);
              if (!base)
                return (
                  <div key={p.key} className="page-holder">
                    <div
                      className="page loading"
                      style={{ width: 595 * scale, height: 842 * scale }}
                    />
                  </div>
                );
              return (
                <PageView
                  key={p.key}
                  pageRef={p}
                  source={p.sourceId ? (sources.get(p.sourceId) ?? null) : null}
                  base={base}
                  scale={scale}
                  number={i + 1}
                  annotations={byPage.get(p.key) ?? []}
                  interaction={interaction}
                  highlights={hitsByPage.get(p.key)}
                />
              );
            })
          )}
        </main>

        {panel && !empty ? (
          <aside className="panel">
            <div className="panel-head">
              <h2>{PANELS.find((x) => x.id === panel)?.label}</h2>
              <button className="icon" onClick={() => setPanel(null)} title="Schließen">
                ✕
              </button>
            </div>
            <div className="panel-body">
              <AnnotationInspector {...panelProps} />
              {panel === 'pages' ? <PagesPanel {...panelProps} /> : null}
              {panel === 'comments' ? <CommentsPanel {...panelProps} /> : null}
              {panel === 'forms' ? <FormsPanel {...panelProps} /> : null}
              {panel === 'sign' ? <SignPanel {...panelProps} /> : null}
              {panel === 'design' ? <DesignPanel {...panelProps} /> : null}
              {panel === 'search' ? <SearchPanel {...panelProps} /> : null}
              {panel === 'properties' ? <PropertiesPanel {...panelProps} /> : null}
            </div>
          </aside>
        ) : null}
        <nav className="rail">
          {PANELS.map((x) => (
            <button
              key={x.id}
              className={panel === x.id ? 'active' : ''}
              disabled={empty}
              title={x.label}
              onClick={() => setPanel(panel === x.id ? null : x.id)}
            >
              <span>{x.icon}</span>
              <small>{x.label.split(' ')[0]}</small>
            </button>
          ))}
        </nav>
      </div>

      {busy ? (
        <div className="busy">
          <div className="spinner" /> {busy}
        </div>
      ) : null}
      {status ? (
        <div className={`toast ${status.kind}`} role="status" onClick={() => setStatus(null)}>
          {status.msg}
        </div>
      ) : null}
      {dragOver ? <div className="drop-hint">Dateien loslassen zum Öffnen</div> : null}
    </div>
  );
}
