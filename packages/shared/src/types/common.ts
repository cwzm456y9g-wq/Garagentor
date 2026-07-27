/** Standard-Query für alle Listen-Endpunkte. */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/** Einheitliche Antwortform aller Listen-Endpunkte. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Fehlerantwort der API (NestJS-Standardform). */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp?: string;
  path?: string;
}

/** Kompakte Referenz auf einen Datensatz, z. B. für Auswahllisten. */
export interface EntityRef {
  id: string;
  label: string;
  sublabel?: string;
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;

export function emptyPage<T>(pageSize = DEFAULT_PAGE_SIZE): Paginated<T> {
  return { items: [], total: 0, page: 1, pageSize, pageCount: 0 };
}
