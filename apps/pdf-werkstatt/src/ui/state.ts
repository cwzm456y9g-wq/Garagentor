import { useCallback, useReducer } from 'react';
import { rotateAnnotation } from '../core/geometry';
import {
  emptyEdits,
  type Annotation,
  type Edits,
  type PageRef,
  type Rotation,
  type Source,
} from '../core/types';

/** Der Teil des Zustands, den Rückgängig/Wiederholen umfasst. */
export interface DocState {
  sources: Source[];
  pages: PageRef[];
  edits: Omit<Edits, 'rasterizedPages'>;
  fileName: string;
}

export const initialDoc = (): DocState => {
  const { annotations, watermark, pageNumbers, headerFooter, metadata, formValues, flattenForms } =
    emptyEdits();
  const edits = {
    annotations,
    watermark,
    pageNumbers,
    headerFooter,
    metadata,
    formValues,
    flattenForms,
  };
  return { sources: [], pages: [], edits, fileName: 'dokument.pdf' };
};

interface History {
  past: DocState[];
  present: DocState;
  future: DocState[];
  /** Stand beim letzten Speichern, für die Warnung beim Schließen. */
  saved: DocState;
}

type Action =
  | { type: 'apply'; fn: (d: DocState) => DocState; record: boolean }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'saved' };

const HISTORY_LIMIT = 100;

function reducer(h: History, action: Action): History {
  switch (action.type) {
    case 'apply': {
      const next = action.fn(h.present);
      if (next === h.present) return h;
      if (!action.record) return { ...h, present: next };
      return {
        ...h,
        past: [...h.past.slice(-HISTORY_LIMIT + 1), h.present],
        present: next,
        future: [],
      };
    }
    case 'undo': {
      const prev = h.past.at(-1);
      if (!prev) return h;
      return { ...h, past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
    }
    case 'redo': {
      const [next, ...rest] = h.future;
      if (!next) return h;
      return { ...h, past: [...h.past, h.present], present: next, future: rest };
    }
    case 'saved':
      return { ...h, saved: h.present };
  }
}

export function useDocument() {
  const [h, dispatch] = useReducer(reducer, undefined, () => {
    const d = initialDoc();
    return { past: [], present: d, future: [], saved: d };
  });
  /** Änderung mit eigenem Rückgängig-Schritt. */
  const commit = useCallback(
    (fn: (d: DocState) => DocState) => dispatch({ type: 'apply', fn, record: true }),
    [],
  );
  /** Änderung ohne neuen Schritt, z. B. während des Ziehens nach einem `commit`. */
  const amend = useCallback(
    (fn: (d: DocState) => DocState) => dispatch({ type: 'apply', fn, record: false }),
    [],
  );
  return {
    doc: h.present,
    commit,
    amend,
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    redo: useCallback(() => dispatch({ type: 'redo' }), []),
    markSaved: useCallback(() => dispatch({ type: 'saved' }), []),
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
    dirty: h.present.pages !== h.saved.pages || h.present.edits !== h.saved.edits,
  };
}

let counter = 0;
export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

// --- Reine Änderungen am Dokument --------------------------------------------

export const setEdits = (d: DocState, patch: Partial<DocState['edits']>): DocState => ({
  ...d,
  edits: { ...d.edits, ...patch },
});

export const addAnnotation = (d: DocState, a: Annotation): DocState =>
  setEdits(d, { annotations: [...d.edits.annotations, a] });

export const updateAnnotation = (
  d: DocState,
  id: string,
  fn: (a: Annotation) => Annotation,
): DocState =>
  setEdits(d, { annotations: d.edits.annotations.map((a) => (a.id === id ? fn(a) : a)) });

export const removeAnnotation = (d: DocState, id: string): DocState =>
  setEdits(d, { annotations: d.edits.annotations.filter((a) => a.id !== id) });

export function rotatePages(d: DocState, keys: Set<string>, delta: number): DocState {
  return {
    ...d,
    pages: d.pages.map((p) =>
      keys.has(p.key)
        ? { ...p, rotation: ((((p.rotation + delta) % 360) + 360) % 360) as Rotation }
        : p,
    ),
    edits: {
      ...d.edits,
      annotations: d.edits.annotations.map((a) =>
        keys.has(a.pageKey) ? rotateAnnotation(a, delta) : a,
      ),
    },
  };
}

export function deletePages(d: DocState, keys: Set<string>): DocState {
  return {
    ...d,
    pages: d.pages.filter((p) => !keys.has(p.key)),
    edits: { ...d.edits, annotations: d.edits.annotations.filter((a) => !keys.has(a.pageKey)) },
  };
}

export function duplicatePages(d: DocState, keys: Set<string>): DocState {
  const pages: PageRef[] = [];
  const annotations = [...d.edits.annotations];
  for (const p of d.pages) {
    pages.push(p);
    if (!keys.has(p.key)) continue;
    const copy = { ...p, key: newId('seite') };
    pages.push(copy);
    for (const a of d.edits.annotations) {
      if (a.pageKey === p.key) annotations.push({ ...a, id: newId('m'), pageKey: copy.key });
    }
  }
  return { ...d, pages, edits: { ...d.edits, annotations } };
}

export function insertBlankAfter(
  d: DocState,
  afterKey: string | null,
  size: { width: number; height: number },
): DocState {
  const blank: PageRef = {
    key: newId('seite'),
    sourceId: null,
    pageIndex: 0,
    rotation: 0,
    blankSize: size,
  };
  const i = afterKey ? d.pages.findIndex((p) => p.key === afterKey) : d.pages.length - 1;
  const pages = [...d.pages];
  pages.splice(i + 1, 0, blank);
  return { ...d, pages };
}

/** Verschiebt die gewählten Seiten geschlossen vor die Zielseite (oder ans Ende). */
export function movePages(d: DocState, keys: Set<string>, beforeKey: string | null): DocState {
  if (beforeKey && keys.has(beforeKey)) return d;
  const moving = d.pages.filter((p) => keys.has(p.key));
  const rest = d.pages.filter((p) => !keys.has(p.key));
  const at = beforeKey ? rest.findIndex((p) => p.key === beforeKey) : rest.length;
  rest.splice(at < 0 ? rest.length : at, 0, ...moving);
  return { ...d, pages: rest };
}

export function shiftPages(d: DocState, keys: Set<string>, dir: -1 | 1): DocState {
  const pages = [...d.pages];
  const order = dir < 0 ? pages.map((_, i) => i) : pages.map((_, i) => pages.length - 1 - i);
  for (const i of order) {
    const j = i + dir;
    if (!keys.has(pages[i]!.key) || j < 0 || j >= pages.length || keys.has(pages[j]!.key)) continue;
    [pages[i], pages[j]] = [pages[j]!, pages[i]!];
  }
  return { ...d, pages };
}

export function reversePages(d: DocState): DocState {
  return { ...d, pages: [...d.pages].reverse() };
}
