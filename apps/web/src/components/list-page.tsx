'use client';

import type { ReactNode } from 'react';
import type { ListState } from '@/lib/hooks';
import { Card, EmptyState, ErrorState, Input, LoadingState, Pagination, Table } from './ui';

interface ListPageProps<T> {
  state: ListState<T>;
  /** Spaltenüberschriften der Tabelle. */
  columns: ReactNode;
  /** Eine Tabellenzeile je Datensatz. */
  renderRow: (item: T) => ReactNode;
  searchPlaceholder?: string;
  /** Zusätzliche Filter über der Tabelle. */
  filters?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Kennung für den React-Schlüssel der Zeilen. */
  rowKey: (item: T) => string;
}

/**
 * Einheitlicher Aufbau aller Listenseiten: Suchfeld, optionale Filter,
 * Tabelle mit Lade-, Leer- und Fehlerzustand sowie Seitenblättern.
 */
export function ListPage<T>({
  state,
  columns,
  renderRow,
  searchPlaceholder = 'Suchen …',
  filters,
  emptyTitle = 'Keine Einträge gefunden',
  emptyDescription,
  emptyAction,
  rowKey,
}: ListPageProps<T>) {
  const { items, data, loading, error, page, setPage, search, setSearch, reload } = state;

  return (
    <Card bodyClassName="">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          className="max-w-xs"
          aria-label={searchPlaceholder}
        />
        {filters}
      </div>

      {error ? (
        <div className="p-5">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : loading && items.length === 0 ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState
          title={search ? `Keine Treffer für „${search}“` : emptyTitle}
          description={search ? 'Bitte den Suchbegriff anpassen.' : emptyDescription}
          action={search ? undefined : emptyAction}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>{columns}</tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={rowKey(item)}>{renderRow(item)}</tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={page}
            pageCount={data?.pageCount ?? 1}
            total={data?.total ?? 0}
            pageSize={data?.pageSize ?? items.length}
            onChange={setPage}
          />
        </>
      )}
    </Card>
  );
}
