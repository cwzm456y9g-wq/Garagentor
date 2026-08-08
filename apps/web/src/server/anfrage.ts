import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type Paginated } from '@garagentor/shared';
import { z, type ZodType } from 'zod';
import { HttpFehler, ungueltig } from './fehler';

/** Übliche Obergrenze für Anfragerümpfe. */
export const RUMPF_STANDARD = 100 * 1024;

/**
 * Größerer Rahmen für die Einstellungen (Logo als Data-URL) und für Abschlüsse
 * mit Unterschrift. Zwei handgeschriebene Züge liegen als PNG-Data-URL
 * typischerweise bei einigen zehn Kilobyte; auf einem hochauflösenden Tablet
 * werden es deutlich mehr.
 */
export const RUMPF_GROSS = 1024 * 1024;

/**
 * Liest den Rumpf und prüft ihn gegen ein Schema.
 *
 * Die Grenze steht hier und nicht in einer Server-Einstellung, weil sie in
 * NestJS pfadabhängig war und es bleiben soll: 100 kB überall, ein Megabyte
 * dort, wo Logo oder Unterschrift mitkommen.
 */
export async function rumpf<T>(
  anfrage: Request,
  schema: ZodType<T>,
  grenze = RUMPF_STANDARD,
): Promise<T> {
  const angekuendigt = anfrage.headers.get('content-length');
  if (angekuendigt && Number.parseInt(angekuendigt, 10) > grenze) {
    throw new HttpFehler(413, `Die Anfrage ist größer als ${Math.round(grenze / 1024)} kB.`);
  }

  const text = await anfrage.text();
  // Auch ohne Content-Length nachmessen – die Angabe ist nicht verlässlich.
  if (text.length > grenze) {
    throw new HttpFehler(413, `Die Anfrage ist größer als ${Math.round(grenze / 1024)} kB.`);
  }
  if (!text) {
    throw ungueltig('Es wurde kein Anfragerumpf übergeben.');
  }

  let gelesen: unknown;
  try {
    gelesen = JSON.parse(text);
  } catch {
    throw ungueltig('Der Anfragerumpf ist kein gültiges JSON.');
  }

  return schema.parse(gelesen);
}

/** Prüft die Abfrageparameter gegen ein Schema. */
export function abfrage<T>(anfrage: Request, schema: ZodType<T>): T {
  const parameter = new URL(anfrage.url).searchParams;
  const roh: Record<string, string | string[]> = {};
  for (const schluessel of new Set(parameter.keys())) {
    const werte = parameter.getAll(schluessel);
    roh[schluessel] = werte.length > 1 ? werte : werte[0];
  }
  return schema.parse(roh);
}

/**
 * Basis für alle Listen-Abfragen.
 *
 * `skip` und `take` waren in der NestJS-Fassung Getter einer DTO-Klasse. Die
 * achtzehn Dienste, die damit arbeiten, sollen unverändert bleiben, deshalb
 * legt das Schema beide Werte gleich mit ab. Zahlen kommen aus der Adresszeile
 * immer als Text – daher der Umweg über `coerce`.
 */
export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    search: z
      .string()
      .trim()
      .optional()
      .transform((wert) => (wert ? wert : undefined)),
    sortBy: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
  })
  .transform((wert) => ({
    ...wert,
    skip: (wert.page - 1) * wert.pageSize,
    take: wert.pageSize,
  }));

export interface PaginationQuery {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
  skip: number;
  take: number;
}

/** Baut die einheitliche Listenantwort. */
export function paginate<T>(items: T[], total: number, query: PaginationQuery): Paginated<T> {
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.ceil(total / query.pageSize) || 0,
  };
}

/**
 * Erzeugt eine Prisma-Sortierung. `allowed` verhindert, dass über den
 * Abfrageparameter nach beliebigen Spalten sortiert wird.
 */
export function orderBy(
  query: PaginationQuery,
  allowed: readonly string[],
  fallback: Record<string, 'asc' | 'desc'>,
): Record<string, 'asc' | 'desc'> {
  if (query.sortBy && allowed.includes(query.sortBy)) {
    return { [query.sortBy]: query.sortDir };
  }
  return fallback;
}
