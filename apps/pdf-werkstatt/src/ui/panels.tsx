import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { FieldInfo } from '../core/forms';
import { readFormFields } from '../core/forms';
import { chunkPages, parseRanges } from '../core/ranges';
import type { Annotation, PageRef, Position } from '../core/types';
import { buildPdf } from './exporter';
import { baseName, download, imageFileToDataUrl } from './files';
import {
  extractText,
  getOutline,
  rasterizePage,
  searchText,
  type OutlineEntry,
  type TextHit,
} from './pdfjs';
import { SignaturePad } from './SignaturePad';
import {
  addAnnotation,
  deletePages,
  duplicatePages,
  insertBlankAfter,
  newId,
  removeAnnotation,
  reversePages,
  rotatePages,
  setEdits,
  shiftPages,
  updateAnnotation,
  type DocState,
} from './state';
import { COLORS, annotationLabel, type Pending, type Tool } from './tools';

export interface PanelProps {
  doc: DocState;
  commit: (fn: (d: DocState) => DocState) => void;
  amend: (fn: (d: DocState) => DocState) => void;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  currentKey: string | null;
  goTo: (key: string) => void;
  notify: (msg: string, kind?: 'ok' | 'error') => void;
  run: (label: string, fn: () => Promise<void>) => Promise<void>;
  setPending: (p: Pending) => void;
  setTool: (t: Tool) => void;
  setSearchHits: (hits: TextHit[]) => void;
  selectedAnnotation: Annotation | null;
  selectAnnotation: (id: string | null) => void;
  addFiles: () => void;
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="panel-section">
    <h3>{title}</h3>
    {children}
  </section>
);

const A4 = { width: 595.28, height: 841.89 };

// --- Seiten ------------------------------------------------------------------

export function PagesPanel(p: PanelProps) {
  const { doc, commit, selected, setSelected, run } = p;
  const count = selected.size;
  const chosen = doc.pages.filter((x) => selected.has(x.key));
  const [ranges, setRanges] = useState('');
  const [every, setEvery] = useState(1);
  const [dpi, setDpi] = useState(150);
  const name = baseName(doc.fileName);

  const selectWhere = (fn: (i: number) => boolean) =>
    setSelected(new Set(doc.pages.filter((_, i) => fn(i)).map((x) => x.key)));

  const exportParts = (parts: PageRef[][], label: string) =>
    run(label, async () => {
      for (const [i, part] of parts.entries()) {
        download(await buildPdf(doc, part), `${name}-teil-${i + 1}.pdf`);
      }
      p.notify(`${parts.length} Datei(en) erstellt.`);
    });

  const insertAfter = p.currentKey ?? doc.pages.at(-1)?.key ?? null;

  return (
    <>
      <Section title={count ? `${count} Seite(n) gewählt` : 'Seiten wählen'}>
        <div className="button-grid">
          <button onClick={() => selectWhere(() => true)}>Alle</button>
          <button onClick={() => setSelected(new Set())}>Keine</button>
          <button onClick={() => selectWhere((i) => i % 2 === 0)}>Ungerade</button>
          <button onClick={() => selectWhere((i) => i % 2 === 1)}>Gerade</button>
        </div>
        <p className="hint">
          In der Seitenleiste mit Strg oder Umschalt mehrere Seiten wählen und zum Umsortieren
          ziehen.
        </p>
      </Section>
      <Section title="Bearbeiten">
        <div className="button-grid">
          <button disabled={!count} onClick={() => commit((d) => rotatePages(d, selected, -90))}>
            ⟲ Links drehen
          </button>
          <button disabled={!count} onClick={() => commit((d) => rotatePages(d, selected, 90))}>
            ⟳ Rechts drehen
          </button>
          <button disabled={!count} onClick={() => commit((d) => shiftPages(d, selected, -1))}>
            ▲ Nach vorn
          </button>
          <button disabled={!count} onClick={() => commit((d) => shiftPages(d, selected, 1))}>
            ▼ Nach hinten
          </button>
          <button disabled={!count} onClick={() => commit((d) => duplicatePages(d, selected))}>
            ⧉ Duplizieren
          </button>
          <button
            className="danger"
            disabled={!count || count === doc.pages.length}
            onClick={() => {
              commit((d) => deletePages(d, selected));
              setSelected(new Set());
            }}
          >
            🗑 Löschen
          </button>
          <button onClick={() => commit(reversePages)}>⇅ Umkehren</button>
          <button onClick={p.addFiles}>＋ Dateien einfügen</button>
        </div>
      </Section>
      <Section title="Leere Seite einfügen (nach der aktuellen)">
        <div className="button-grid">
          <button onClick={() => commit((d) => insertBlankAfter(d, insertAfter, A4))}>
            A4 hoch
          </button>
          <button
            onClick={() =>
              commit((d) =>
                insertBlankAfter(d, insertAfter, { width: A4.height, height: A4.width }),
              )
            }
          >
            A4 quer
          </button>
        </div>
      </Section>
      <Section title="Seiten herauslösen">
        <button
          disabled={!count}
          onClick={() => exportParts([chosen], 'Seiten werden herausgelöst …')}
        >
          Gewählte Seiten als neues PDF
        </button>
      </Section>
      <Section title="Teilen">
        <label>
          Nach Bereichen, z. B. „1-3, 4-6, 7-“
          <input value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3, 4-" />
        </label>
        <button
          disabled={!ranges.trim()}
          onClick={() => {
            try {
              const parts = parseRanges(ranges, doc.pages.length).map((idx) =>
                idx.map((i) => doc.pages[i]!),
              );
              void exportParts(parts, 'Dokument wird geteilt …');
            } catch (err) {
              p.notify((err as Error).message, 'error');
            }
          }}
        >
          Nach Bereichen teilen
        </button>
        <label>
          Alle
          <input
            type="number"
            min={1}
            value={every}
            onChange={(e) => setEvery(Math.max(1, Number(e.target.value)))}
          />
          Seiten ein neues Dokument
        </label>
        <button
          onClick={() =>
            exportParts(
              chunkPages(doc.pages.length, every).map((idx) => idx.map((i) => doc.pages[i]!)),
              'Dokument wird geteilt …',
            )
          }
        >
          Gleichmäßig teilen
        </button>
      </Section>
      <Section title="Als Bilder exportieren">
        <label>
          Auflösung
          <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
            <option value={72}>72 dpi (Bildschirm)</option>
            <option value={150}>150 dpi</option>
            <option value={300}>300 dpi (Druck)</option>
          </select>
        </label>
        <button
          onClick={() =>
            run('Bilder werden erzeugt …', async () => {
              const list = count ? chosen : doc.pages;
              const byId = new Map(doc.sources.map((s) => [s.id, s]));
              for (const ref of list) {
                const blob = await rasterizePage(
                  ref.sourceId ? (byId.get(ref.sourceId) ?? null) : null,
                  ref,
                  dpi,
                );
                download(blob, `${name}-seite-${doc.pages.indexOf(ref) + 1}.png`, 'image/png');
              }
            })
          }
        >
          {count ? 'Gewählte Seiten' : 'Alle Seiten'} als PNG
        </button>
        <p className="hint">
          Markierungen werden dabei nicht mitgezeichnet – vorher speichern und neu öffnen.
        </p>
      </Section>
    </>
  );
}

// --- Kommentare --------------------------------------------------------------

export function CommentsPanel(p: PanelProps) {
  const { doc } = p;
  const order = new Map(doc.pages.map((x, i) => [x.key, i]));
  const list = [...doc.edits.annotations].sort(
    (a, b) => (order.get(a.pageKey) ?? 0) - (order.get(b.pageKey) ?? 0),
  );

  const describe = (a: Annotation) =>
    a.kind === 'text' || a.kind === 'note' || a.kind === 'stamp' ? a.text || '(leer)' : '';

  const exportSummary = () => {
    const lines = list.map(
      (a) =>
        `Seite ${(order.get(a.pageKey) ?? 0) + 1} – ${annotationLabel[a.kind]}${describe(a) ? `: ${describe(a)}` : ''}`,
    );
    download(
      new Blob([lines.join('\n') + '\n'], { type: 'text/plain' }),
      `${baseName(doc.fileName)}-kommentare.txt`,
    );
  };

  return (
    <Section title={`${list.length} Markierung(en)`}>
      {list.length === 0 ? (
        <p className="hint">
          Noch keine Markierungen. Werkzeug oben wählen und auf eine Seite klicken oder ziehen.
        </p>
      ) : null}
      <ul className="comment-list">
        {list.map((a) => (
          <li key={a.id} className={p.selectedAnnotation?.id === a.id ? 'active' : ''}>
            <button
              className="link"
              onClick={() => {
                p.goTo(a.pageKey);
                p.selectAnnotation(a.id);
              }}
            >
              <strong>S. {(order.get(a.pageKey) ?? 0) + 1}</strong> {annotationLabel[a.kind]}
              {describe(a) ? <span className="muted"> – {describe(a).slice(0, 60)}</span> : null}
            </button>
            <button
              className="icon"
              title="Löschen"
              onClick={() => p.commit((d) => removeAnnotation(d, a.id))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {list.length ? (
        <div className="button-grid">
          <button onClick={exportSummary}>Liste exportieren</button>
          <button
            className="danger"
            onClick={() => p.commit((d) => setEdits(d, { annotations: [] }))}
          >
            Alle löschen
          </button>
        </div>
      ) : null}
    </Section>
  );
}

/** Eigenschaften der gewählten Markierung. */
export function AnnotationInspector(p: PanelProps) {
  const a = p.selectedAnnotation;
  if (!a) return null;
  const update = (fn: (x: Annotation) => Annotation) =>
    p.commit((d) => updateAnnotation(d, a.id, fn));
  return (
    <Section title={`Auswahl: ${annotationLabel[a.kind]}`}>
      {'color' in a && a.kind !== 'note' ? (
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch${a.color === c ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => update((x) => ('color' in x ? { ...x, color: c } : x))}
              aria-label={c}
            />
          ))}
          <input
            type="color"
            value={a.color}
            onChange={(e) => update((x) => ('color' in x ? { ...x, color: e.target.value } : x))}
          />
        </div>
      ) : null}
      {a.kind === 'text' ? (
        <div className="row">
          <label className="inline">
            Größe
            <input
              type="number"
              min={4}
              max={144}
              value={a.fontSize}
              onChange={(e) =>
                update((x) =>
                  x.kind === 'text' ? { ...x, fontSize: Number(e.target.value) || 12 } : x,
                )
              }
            />
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={a.bold}
              onChange={(e) =>
                update((x) => (x.kind === 'text' ? { ...x, bold: e.target.checked } : x))
              }
            />{' '}
            Fett
          </label>
        </div>
      ) : null}
      {'strokeWidth' in a ? (
        <label className="inline">
          Linienstärke
          <input
            type="range"
            min={0.5}
            max={12}
            step={0.5}
            value={a.strokeWidth}
            onChange={(e) =>
              update((x) =>
                'strokeWidth' in x ? { ...x, strokeWidth: Number(e.target.value) } : x,
              )
            }
          />
        </label>
      ) : null}
      {a.kind === 'rect' ? (
        <label className="inline">
          <input
            type="checkbox"
            checked={a.fill}
            onChange={(e) =>
              update((x) => (x.kind === 'rect' ? { ...x, fill: e.target.checked } : x))
            }
          />{' '}
          Gefüllt
        </label>
      ) : null}
      {a.kind === 'stamp' ? (
        <input
          value={a.text}
          onChange={(e) => update((x) => (x.kind === 'stamp' ? { ...x, text: e.target.value } : x))}
        />
      ) : null}
      {a.kind === 'redact' ? (
        <p className="hint">
          Beim Speichern wird diese Seite als Bild neu erzeugt. Der Inhalt unter dem Balken ist
          danach nicht mehr in der Datei.
        </p>
      ) : null}
      <div className="button-grid">
        <button
          onClick={() => {
            const copy = { ...a, id: newId('m') };
            p.commit((d) => addAnnotation(d, copy));
            p.selectAnnotation(copy.id);
          }}
        >
          Duplizieren
        </button>
        <button className="danger" onClick={() => p.commit((d) => removeAnnotation(d, a.id))}>
          Löschen (Entf)
        </button>
      </div>
    </Section>
  );
}

// --- Formulare -----------------------------------------------------------------

export function FormsPanel(p: PanelProps) {
  const { doc } = p;
  const [fields, setFields] = useState<Record<string, FieldInfo[]>>({});
  const used = useMemo(() => {
    const ids = new Set(doc.pages.map((x) => x.sourceId));
    return doc.sources.filter((s) => ids.has(s.id));
  }, [doc.pages, doc.sources]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const out: Record<string, FieldInfo[]> = {};
      for (const s of used) {
        try {
          out[s.id] = await readFormFields(s.bytes);
        } catch {
          out[s.id] = [];
        }
      }
      if (alive) setFields(out);
    })();
    return () => {
      alive = false;
    };
  }, [used]);

  const total = Object.values(fields).reduce((n, f) => n + f.length, 0);
  const valueOf = (sid: string, f: FieldInfo) => doc.edits.formValues[sid]?.[f.name] ?? f.value;
  const setValue = (sid: string, name: string, v: string | boolean, record = false) =>
    (record ? p.commit : p.amend)((d) =>
      setEdits(d, {
        formValues: { ...d.edits.formValues, [sid]: { ...d.edits.formValues[sid], [name]: v } },
      }),
    );

  return (
    <>
      <Section title="Formular ausfüllen">
        {total === 0 ? (
          <p className="hint">
            Dieses Dokument hat keine ausfüllbaren Felder. Mit dem Text-Werkzeug lässt sich trotzdem
            überall schreiben.
          </p>
        ) : null}
        {used.map((s) =>
          fields[s.id]?.length ? (
            <div key={s.id} className="form-group">
              {used.length > 1 ? <h4>{s.name}</h4> : null}
              {fields[s.id]!.map((f) => (
                <label key={f.name} className={f.type === 'checkbox' ? 'inline' : ''}>
                  {f.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      disabled={f.readOnly}
                      checked={Boolean(valueOf(s.id, f))}
                      onChange={(e) => setValue(s.id, f.name, e.target.checked, true)}
                    />
                  ) : null}
                  {f.name}
                  {f.type === 'text' ? (
                    f.multiline ? (
                      <textarea
                        disabled={f.readOnly}
                        value={String(valueOf(s.id, f))}
                        onFocus={() => p.commit((d) => ({ ...d }))}
                        onChange={(e) => setValue(s.id, f.name, e.target.value)}
                      />
                    ) : (
                      <input
                        disabled={f.readOnly}
                        value={String(valueOf(s.id, f))}
                        onFocus={() => p.commit((d) => ({ ...d }))}
                        onChange={(e) => setValue(s.id, f.name, e.target.value)}
                      />
                    )
                  ) : f.type === 'choice' ? (
                    <select
                      disabled={f.readOnly}
                      value={String(valueOf(s.id, f))}
                      onChange={(e) => setValue(s.id, f.name, e.target.value, true)}
                    >
                      <option value="">–</option>
                      {f.options.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : null}
                </label>
              ))}
            </div>
          ) : null,
        )}
      </Section>
      {total > 0 ? (
        <Section title="Beim Speichern">
          <label className="inline">
            <input
              type="checkbox"
              checked={doc.edits.flattenForms}
              onChange={(e) => p.commit((d) => setEdits(d, { flattenForms: e.target.checked }))}
            />
            Formular reduzieren (Felder werden fester Text)
          </label>
          <p className="hint">
            Die Werte erscheinen in der Datei, sobald sie gespeichert ist. Beim Zusammenfügen
            mehrerer Dokumente bleiben nur die Felder des ersten bearbeitbar.
          </p>
        </Section>
      ) : null}
    </>
  );
}

// --- Unterschreiben & Stempeln ----------------------------------------------------

const SIG_KEY = 'pdf-werkstatt:unterschriften';
const loadSigs = (): { dataUrl: string; aspect: number }[] => {
  try {
    return JSON.parse(localStorage.getItem(SIG_KEY) ?? '[]');
  } catch {
    return [];
  }
};
const saveSigs = (s: { dataUrl: string; aspect: number }[]) => {
  try {
    localStorage.setItem(SIG_KEY, JSON.stringify(s));
  } catch {
    /* Ohne Speicher bleiben Unterschriften nur für diese Sitzung. */
  }
};

const STAMPS: { text: string; color: string }[] = [
  { text: 'Genehmigt', color: '#15803d' },
  { text: 'Abgelehnt', color: '#dc2626' },
  { text: 'Entwurf', color: '#2563eb' },
  { text: 'Vertraulich', color: '#dc2626' },
  { text: 'Bezahlt', color: '#15803d' },
  { text: 'Geprüft', color: '#7c3aed' },
  { text: 'Kopie', color: '#4b5563' },
  { text: 'Erledigt', color: '#15803d' },
];

export function SignPanel(p: PanelProps) {
  const [sigs, setSigs] = useState(loadSigs);
  const [custom, setCustom] = useState('');
  const [customColor, setCustomColor] = useState('#dc2626');

  const place = (dataUrl: string, aspect: number, label: string) => {
    p.setPending({ kind: 'image', dataUrl, aspect, label });
    p.notify(`Jetzt auf die Seite klicken (oder Rahmen ziehen), um ${label} zu setzen.`);
  };

  return (
    <>
      <Section title="Unterschrift">
        <SignaturePad
          onDone={(dataUrl, aspect) => {
            const next = [{ dataUrl, aspect }, ...sigs].slice(0, 6);
            setSigs(next);
            saveSigs(next);
            place(dataUrl, aspect, 'die Unterschrift');
          }}
        />
        {sigs.length ? (
          <div className="sig-list">
            {sigs.map((s, i) => (
              <div key={i} className="sig-item">
                <button
                  onClick={() => place(s.dataUrl, s.aspect, 'die Unterschrift')}
                  title="Platzieren"
                >
                  <img src={s.dataUrl} alt="Unterschrift" />
                </button>
                <button
                  className="icon"
                  title="Entfernen"
                  onClick={() => {
                    const next = sigs.filter((_, k) => k !== i);
                    setSigs(next);
                    saveSigs(next);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <p className="hint">
          Gespeicherte Unterschriften bleiben nur in diesem Browser. Das ist eine einfache
          elektronische Unterschrift, keine qualifizierte Signatur.
        </p>
      </Section>
      <Section title="Stempel">
        <div className="stamp-grid">
          {STAMPS.map((s) => (
            <button
              key={s.text}
              className="stamp-button"
              style={{ color: s.color, borderColor: s.color }}
              onClick={() => {
                p.setPending({ kind: 'stamp', ...s });
                p.notify('Jetzt auf die Seite klicken oder einen Rahmen ziehen.');
              }}
            >
              {s.text.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="row">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Eigener Stempel"
          />
          <input
            type="color"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
          />
          <button
            disabled={!custom.trim()}
            onClick={() => p.setPending({ kind: 'stamp', text: custom.trim(), color: customColor })}
          >
            Setzen
          </button>
        </div>
      </Section>
      <Section title="Bild einfügen">
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const dataUrl = await imageFileToDataUrl(file);
            const img = new Image();
            img.onload = () => place(dataUrl, img.width / img.height, 'das Bild');
            img.src = dataUrl;
          }}
        />
      </Section>
    </>
  );
}

// --- Gestalten -------------------------------------------------------------------

const POSITIONS: { id: Position; label: string }[] = [
  { id: 'bottom-center', label: 'Unten Mitte' },
  { id: 'bottom-right', label: 'Unten rechts' },
  { id: 'bottom-left', label: 'Unten links' },
  { id: 'top-center', label: 'Oben Mitte' },
  { id: 'top-right', label: 'Oben rechts' },
  { id: 'top-left', label: 'Oben links' },
];

export function DesignPanel(p: PanelProps) {
  const { doc, commit, amend } = p;
  const { watermark: wm, pageNumbers: pn, headerFooter: hf } = doc.edits;
  const patch = (fn: (d: DocState) => DocState) => amend(fn);

  return (
    <>
      <Section title="Wasserzeichen">
        <label className="inline">
          <input
            type="checkbox"
            checked={Boolean(wm)}
            onChange={(e) =>
              commit((d) =>
                setEdits(d, {
                  watermark: e.target.checked
                    ? {
                        text: 'VERTRAULICH',
                        fontSize: 60,
                        color: '#dc2626',
                        opacity: 0.2,
                        angle: 45,
                      }
                    : null,
                }),
              )
            }
          />
          Auf jeder Seite
        </label>
        {wm ? (
          <>
            <input
              value={wm.text}
              onFocus={() => commit((d) => ({ ...d }))}
              onChange={(e) =>
                patch((d) => setEdits(d, { watermark: { ...wm, text: e.target.value } }))
              }
            />
            <div className="row">
              <label className="inline">
                Größe{' '}
                <input
                  type="number"
                  min={8}
                  max={300}
                  value={wm.fontSize}
                  onChange={(e) =>
                    commit((d) =>
                      setEdits(d, { watermark: { ...wm, fontSize: Number(e.target.value) || 60 } }),
                    )
                  }
                />
              </label>
              <label className="inline">
                Farbe{' '}
                <input
                  type="color"
                  value={wm.color}
                  onChange={(e) =>
                    commit((d) => setEdits(d, { watermark: { ...wm, color: e.target.value } }))
                  }
                />
              </label>
            </div>
            <label className="inline">
              Deckkraft{' '}
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={wm.opacity}
                onChange={(e) =>
                  commit((d) =>
                    setEdits(d, { watermark: { ...wm, opacity: Number(e.target.value) } }),
                  )
                }
              />
            </label>
            <label className="inline">
              Winkel{' '}
              <input
                type="range"
                min={-90}
                max={90}
                step={5}
                value={wm.angle}
                onChange={(e) =>
                  commit((d) =>
                    setEdits(d, { watermark: { ...wm, angle: Number(e.target.value) } }),
                  )
                }
              />{' '}
              {wm.angle}°
            </label>
          </>
        ) : null}
      </Section>
      <Section title="Seitenzahlen / Bates-Nummern">
        <label className="inline">
          <input
            type="checkbox"
            checked={Boolean(pn)}
            onChange={(e) =>
              commit((d) =>
                setEdits(d, {
                  pageNumbers: e.target.checked
                    ? {
                        format: 'Seite {n} von {total}',
                        position: 'bottom-center',
                        fontSize: 10,
                        startAt: 1,
                        padDigits: 0,
                        skipFirst: false,
                      }
                    : null,
                }),
              )
            }
          />
          Seitenzahlen einfügen
        </label>
        {pn ? (
          <>
            <label>
              Format ({'{n}'} = Nummer, {'{total}'} = letzte)
              <input
                value={pn.format}
                onFocus={() => commit((d) => ({ ...d }))}
                onChange={(e) =>
                  patch((d) => setEdits(d, { pageNumbers: { ...pn, format: e.target.value } }))
                }
              />
            </label>
            <div className="row">
              <select
                value={pn.position}
                onChange={(e) =>
                  commit((d) =>
                    setEdits(d, { pageNumbers: { ...pn, position: e.target.value as Position } }),
                  )
                }
              >
                {POSITIONS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
              <label className="inline">
                Größe{' '}
                <input
                  type="number"
                  min={5}
                  max={48}
                  value={pn.fontSize}
                  onChange={(e) =>
                    commit((d) =>
                      setEdits(d, {
                        pageNumbers: { ...pn, fontSize: Number(e.target.value) || 10 },
                      }),
                    )
                  }
                />
              </label>
            </div>
            <div className="row">
              <label className="inline">
                Beginnt bei{' '}
                <input
                  type="number"
                  min={0}
                  value={pn.startAt}
                  onChange={(e) =>
                    commit((d) =>
                      setEdits(d, { pageNumbers: { ...pn, startAt: Number(e.target.value) } }),
                    )
                  }
                />
              </label>
              <label className="inline">
                Stellen{' '}
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={pn.padDigits}
                  onChange={(e) =>
                    commit((d) =>
                      setEdits(d, { pageNumbers: { ...pn, padDigits: Number(e.target.value) } }),
                    )
                  }
                />
              </label>
            </div>
            <label className="inline">
              <input
                type="checkbox"
                checked={pn.skipFirst}
                onChange={(e) =>
                  commit((d) =>
                    setEdits(d, { pageNumbers: { ...pn, skipFirst: e.target.checked } }),
                  )
                }
              />{' '}
              Deckblatt nicht nummerieren
            </label>
            <button
              onClick={() =>
                commit((d) =>
                  setEdits(d, {
                    pageNumbers: {
                      ...pn,
                      format: 'AKTE-{n}',
                      padDigits: 6,
                      position: 'bottom-right',
                    },
                  }),
                )
              }
            >
              Vorlage: Bates-Nummerierung
            </button>
          </>
        ) : null}
      </Section>
      <Section title="Kopf- und Fußzeile">
        <label className="inline">
          <input
            type="checkbox"
            checked={Boolean(hf)}
            onChange={(e) =>
              commit((d) =>
                setEdits(d, {
                  headerFooter: e.target.checked
                    ? {
                        headerLeft: '',
                        headerCenter: '',
                        headerRight: '{date}',
                        footerLeft: doc.edits.metadata?.title ?? '',
                        footerCenter: '',
                        footerRight: '',
                        fontSize: 9,
                      }
                    : null,
                }),
              )
            }
          />
          Kopf- und Fußzeile einfügen
        </label>
        {hf ? (
          <>
            <p className="hint">
              Platzhalter: {'{n}'} Seite, {'{total}'} Seitenzahl, {'{date}'} heutiges Datum.
            </p>
            {(
              [
                ['headerLeft', 'Kopf links'],
                ['headerCenter', 'Kopf Mitte'],
                ['headerRight', 'Kopf rechts'],
                ['footerLeft', 'Fuß links'],
                ['footerCenter', 'Fuß Mitte'],
                ['footerRight', 'Fuß rechts'],
              ] as const
            ).map(([k, label]) => (
              <label key={k}>
                {label}
                <input
                  value={hf[k]}
                  onFocus={() => commit((d) => ({ ...d }))}
                  onChange={(e) =>
                    patch((d) => setEdits(d, { headerFooter: { ...hf, [k]: e.target.value } }))
                  }
                />
              </label>
            ))}
            <label className="inline">
              Größe{' '}
              <input
                type="number"
                min={5}
                max={36}
                value={hf.fontSize}
                onChange={(e) =>
                  commit((d) =>
                    setEdits(d, { headerFooter: { ...hf, fontSize: Number(e.target.value) || 9 } }),
                  )
                }
              />
            </label>
          </>
        ) : null}
      </Section>
      <p className="hint">
        Wasserzeichen, Seitenzahlen und Kopfzeilen erscheinen in der gespeicherten Datei.
      </p>
    </>
  );
}

// --- Suchen ------------------------------------------------------------------------

export function SearchPanel(p: PanelProps) {
  const { doc } = p;
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [hits, setHits] = useState<TextHit[] | null>(null);
  const order = new Map(doc.pages.map((x, i) => [x.key, i]));

  const { setSearchHits } = p;
  useEffect(() => () => setSearchHits([]), [setSearchHits]);

  const search = () =>
    p.run('Suche läuft …', async () => {
      const found = await searchText(doc.sources, doc.pages, query.trim(), caseSensitive);
      setHits(found);
      p.setSearchHits(found);
      if (found[0]) p.goTo(found[0].pageKey);
    });

  const markAll = (kind: 'highlight' | 'redact') => {
    if (!hits?.length) return;
    p.commit((d) =>
      setEdits(d, {
        annotations: [
          ...d.edits.annotations,
          ...hits.map((h): Annotation =>
            kind === 'highlight'
              ? {
                  id: newId('m'),
                  pageKey: h.pageKey,
                  kind: 'highlight',
                  box: h.box,
                  color: '#facc15',
                }
              : { id: newId('m'), pageKey: h.pageKey, kind: 'redact', box: h.box },
          ),
        ],
      }),
    );
    p.notify(
      kind === 'redact'
        ? `${hits.length} Stellen zum Schwärzen markiert. Erst beim Speichern wird entfernt.`
        : `${hits.length} Stellen hervorgehoben.`,
    );
  };

  return (
    <>
      <Section title="Text suchen">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) void search();
          }}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchbegriff"
          />
          <button className="primary" type="submit" disabled={!query.trim()}>
            Suchen
          </button>
        </form>
        <label className="inline">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />{' '}
          Groß-/Kleinschreibung beachten
        </label>
        {hits ? <p>{hits.length} Treffer</p> : null}
        {hits?.length ? (
          <>
            <div className="button-grid">
              <button onClick={() => markAll('highlight')}>Alle hervorheben</button>
              <button className="danger" onClick={() => markAll('redact')}>
                Alle schwärzen
              </button>
            </div>
            <ul className="comment-list">
              {hits.slice(0, 200).map((h, i) => (
                <li key={i}>
                  <button className="link" onClick={() => p.goTo(h.pageKey)}>
                    <strong>S. {(order.get(h.pageKey) ?? 0) + 1}</strong>{' '}
                    <span className="muted">{h.snippet.slice(0, 70)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="hint">Gescannte Seiten ohne Textebene lassen sich nicht durchsuchen.</p>
      </Section>
      <Section title="Text herausziehen">
        <button
          onClick={() =>
            p.run('Text wird gelesen …', async () => {
              const text = await extractText(doc.sources, doc.pages);
              download(
                new Blob([text], { type: 'text/plain;charset=utf-8' }),
                `${baseName(doc.fileName)}.txt`,
              );
            })
          }
        >
          Gesamten Text als .txt speichern
        </button>
      </Section>
    </>
  );
}

// --- Eigenschaften ---------------------------------------------------------------------

export function PropertiesPanel(p: PanelProps) {
  const { doc, commit, amend } = p;
  const md = doc.edits.metadata ?? { title: '', author: '', subject: '', keywords: '' };
  const [outlines, setOutlines] = useState<Record<string, OutlineEntry[]>>({});

  useEffect(() => {
    let alive = true;
    void (async () => {
      const out: Record<string, OutlineEntry[]> = {};
      for (const s of doc.sources) out[s.id] = await getOutline(s).catch(() => []);
      if (alive) setOutlines(out);
    })();
    return () => {
      alive = false;
    };
  }, [doc.sources]);

  const jump = (sourceId: string, pageIndex: number | null) => {
    const ref = doc.pages.find((x) => x.sourceId === sourceId && x.pageIndex === pageIndex);
    if (ref) p.goTo(ref.key);
    else p.notify('Diese Seite ist nicht mehr im Dokument.', 'error');
  };

  const renderOutline = (sid: string, items: OutlineEntry[]): ReactNode => (
    <ul className="outline">
      {items.map((o, i) => (
        <li key={i}>
          <button className="link" onClick={() => jump(sid, o.pageIndex)}>
            {o.title}
          </button>
          {o.children.length ? renderOutline(sid, o.children) : null}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <Section title="Dateiname">
        <input
          value={doc.fileName}
          onFocus={() => commit((d) => ({ ...d }))}
          onChange={(e) => amend((d) => ({ ...d, fileName: e.target.value }))}
        />
      </Section>
      <Section title="Dokumenteigenschaften">
        {(
          [
            ['title', 'Titel'],
            ['author', 'Autor'],
            ['subject', 'Betreff'],
            ['keywords', 'Stichwörter (mit Komma getrennt)'],
          ] as const
        ).map(([k, label]) => (
          <label key={k}>
            {label}
            <input
              value={md[k]}
              onFocus={() => commit((d) => ({ ...d }))}
              onChange={(e) =>
                amend((d) => setEdits(d, { metadata: { ...md, [k]: e.target.value } }))
              }
            />
          </label>
        ))}
      </Section>
      <Section title="Inhalt">
        <p>
          {doc.pages.length} Seite(n) aus {doc.sources.length} Datei(en)
        </p>
        <ul className="plain">
          {doc.sources.map((s) => (
            <li key={s.id}>
              {s.name} <span className="muted">({(s.bytes.length / 1024).toFixed(0)} KB)</span>
            </li>
          ))}
        </ul>
      </Section>
      {Object.entries(outlines).some(([, o]) => o.length) ? (
        <Section title="Lesezeichen">
          {doc.sources.map((s) =>
            outlines[s.id]?.length ? (
              <div key={s.id}>
                {doc.sources.length > 1 ? <h4>{s.name}</h4> : null}
                {renderOutline(s.id, outlines[s.id]!)}
              </div>
            ) : null,
          )}
        </Section>
      ) : null}
    </>
  );
}
