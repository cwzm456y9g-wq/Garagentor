'use client';

import type { Paginated } from '@garagentor/shared';
import { DEFAULT_PAGE_SIZE } from '@garagentor/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type RequestOptions } from './api-client';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Lädt die Daten erneut, etwa nach einer Änderung. */
  reload: () => void;
}

/**
 * Lädt Daten von der API. Laufende Anfragen werden bei einer Änderung der
 * Parameter abgebrochen, damit keine veraltete Antwort die neuere überschreibt.
 */
export function useApi<T>(
  path: string | null,
  query?: RequestOptions['query'],
  deps: unknown[] = [],
): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Der Query wird über seine serialisierte Form verglichen, damit ein neues
  // Objekt mit gleichem Inhalt kein erneutes Laden auslöst.
  const querySignature = JSON.stringify(query ?? {});

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    api
      .get<T>(path, JSON.parse(querySignature) as RequestOptions['query'], controller.signal)
      .then((result) => setData(result))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof ApiError ? cause.message : 'Die Daten konnten nicht geladen werden.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, querySignature, nonce, ...deps]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, loading, error, reload };
}

export interface ListState<T> extends FetchState<Paginated<T>> {
  page: number;
  setPage: (page: number) => void;
  search: string;
  setSearch: (search: string) => void;
  items: T[];
}

/**
 * Listenansicht mit Seitenblättern und entprellter Suche. Bei einer neuen
 * Suche wird auf die erste Seite zurückgesprungen.
 */
export function useList<T>(
  path: string,
  filters: Record<string, string | number | boolean | undefined> = {},
  pageSize = DEFAULT_PAGE_SIZE,
): ListState<T> {
  const [page, setPage] = useState(1);
  const [search, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Die Eingabe wird kurz gesammelt, damit nicht jeder Tastendruck eine
  // Anfrage auslöst.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filterSignature = JSON.stringify(filters);
  const previousSignature = useRef(filterSignature);
  const previousSearch = useRef(debouncedSearch);

  useEffect(() => {
    if (
      previousSignature.current !== filterSignature ||
      previousSearch.current !== debouncedSearch
    ) {
      previousSignature.current = filterSignature;
      previousSearch.current = debouncedSearch;
      setPage(1);
    }
  }, [filterSignature, debouncedSearch]);

  const query = useMemo(
    () => ({
      ...(JSON.parse(filterSignature) as Record<string, string | number | boolean | undefined>),
      page,
      pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [filterSignature, page, pageSize, debouncedSearch],
  );

  const state = useApi<Paginated<T>>(path, query);

  const setSearch = useCallback((value: string) => setSearchValue(value), []);

  return {
    ...state,
    page,
    setPage,
    search,
    setSearch,
    items: state.data?.items ?? [],
  };
}

/** Führt eine ändernde Aktion aus und hält Ladezustand sowie Fehler fest. */
export function useAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
): {
  run: (...args: TArgs) => Promise<TResult | null>;
  loading: boolean;
  error: string | null;
  reset: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setLoading(true);
      setError(null);
      try {
        return await action(...args);
      } catch (cause) {
        // Validierungsfehler der API werden als Liste geliefert.
        setError(
          cause instanceof ApiError
            ? cause.messages.join(' ')
            : 'Die Aktion konnte nicht ausgeführt werden.',
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [action],
  );

  return { run, loading, error, reset: () => setError(null) };
}
