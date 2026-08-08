'use client';

import type { SearchResponse } from '@garagentor/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { Spinner } from './ui';

const TYPE_LABELS: Record<string, string> = {
  CUSTOMER: 'Kunde',
  DOOR: 'Toranlage',
  QUOTE: 'Angebot',
  ORDER: 'Auftrag',
  INVOICE: 'Rechnung',
  ARTICLE: 'Artikel',
  INSPECTION: 'Prüfung',
  SERVICE_REPORT: 'Servicebericht',
  PROJECT: 'Projekt',
};

/** Globale Suche in der Kopfzeile mit Vorschlagsliste. */
export function GlobalSearch() {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Erst ab zwei Zeichen und mit kurzer Verzögerung suchen.
  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setResult(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .get<SearchResponse>('/search', { q: query, limit: 12 }, controller.signal)
        .then((response) => {
          setResult(response);
          setOpen(true);
        })
        .catch(() => setResult(null))
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  // Klick außerhalb schließt die Vorschlagsliste.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function go(href: string) {
    setOpen(false);
    setTerm('');
    router.push(href);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-lg">
      <label className="sr-only" htmlFor="global-search">
        Suche
      </label>
      <input
        id="global-search"
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onFocus={() => result && setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'Enter' && result?.hits.length) go(result.hits[0].href);
        }}
        placeholder="Kunde, Tor, Beleg oder Artikel suchen …"
        className="w-full rounded-md border border-slate-300 bg-flaeche py-2 pl-3 pr-9 text-sm
          placeholder:text-slate-400"
        autoComplete="off"
      />
      {loading && <Spinner className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />}

      {open && result && (
        <div
          className="absolute z-30 mt-1 max-h-[70vh] w-full overflow-y-auto rounded-md border
            border-slate-200 bg-flaeche py-1 shadow-lg"
        >
          {result.hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Keine Treffer für „{result.query}“.</p>
          ) : (
            result.hits.map((hit) => (
              <button
                key={`${hit.type}-${hit.id}`}
                type="button"
                onClick={() => go(hit.href)}
                className="hover:bg-flaeche-aktiv flex w-full items-start gap-3 px-4 py-2 text-left"
              >
                <span
                  className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px]
                    font-medium text-slate-600"
                >
                  {TYPE_LABELS[hit.type] ?? hit.type}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-900">{hit.title}</span>
                  {hit.subtitle && (
                    <span className="block truncate text-xs text-slate-500">{hit.subtitle}</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
