import type { ApiErrorBody, AuthTokens, LoginResponse, Paginated } from '@garagentor/shared';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const ACCESS_KEY = 'garagentor.accessToken';
const REFRESH_KEY = 'garagentor.refreshToken';

/** Fehler der API mit Statuscode und aufbereiteter Meldung. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: ApiErrorBody,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Validierungsfehler liefert die API als Liste von Meldungen. */
  get messages(): string[] {
    const message = this.body?.message;
    if (Array.isArray(message)) return message;
    return [this.message];
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

/* Tokenablage ---------------------------------------------------------- */

export const tokenStore = {
  get access(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: AuthTokens): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

/** Wird ausgelöst, wenn die Sitzung endgültig abgelaufen ist. */
type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  onSessionExpired = handler;
}

/**
 * Läuft gerade eine Erneuerung, warten alle weiteren Anfragen auf dasselbe
 * Ergebnis. Sonst würde jede parallele Anfrage den Refresh-Token einlösen und
 * durch die Rotation die Sitzung der übrigen entwerten.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return null;

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        tokenStore.clear();
        return null;
      }

      const tokens = (await response.json()) as LoginResponse;
      tokenStore.set(tokens);
      return tokens.accessToken;
    } catch {
      return null;
    } finally {
      // Erst nach dem Abschluss freigeben, damit wartende Anfragen dasselbe
      // Ergebnis erhalten.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();

  return refreshInFlight;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Query-Parameter; leere Werte werden ausgelassen. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Ohne Authentifizierung senden, etwa beim Login. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | undefined;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    body = undefined;
  }

  const raw = body?.message;
  const message = Array.isArray(raw)
    ? raw.join(' ')
    : (raw ?? `Die Anfrage ist fehlgeschlagen (${response.status}).`);

  return new ApiError(response.status, message, body);
}

/**
 * Führt eine Anfrage aus. Bei einem abgelaufenen Access-Token wird einmalig
 * erneuert und die Anfrage wiederholt.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (token: string | null): Promise<Response> => {
    const isFormData = options.body instanceof FormData;

    return fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: isFormData
        ? (options.body as FormData)
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
      signal: options.signal,
    });
  };

  let response = await send(options.anonymous ? null : tokenStore.access);

  if (response.status === 401 && !options.anonymous) {
    const token = await refreshAccessToken();
    if (token) {
      response = await send(token);
    } else {
      tokenStore.clear();
      onSessionExpired?.();
      throw new ApiError(401, 'Die Sitzung ist abgelaufen. Bitte erneut anmelden.');
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Wie `request`, gibt aber die Antwort selbst zurück – für Dateien, die nicht
 * als JSON ausgewertet werden. Token und Erneuerung laufen gleich.
 */
export async function requestRaw(path: string, query?: RequestOptions['query']): Promise<Response> {
  const send = (token: string | null) =>
    fetch(buildUrl(path, query), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  let response = await send(tokenStore.access);

  if (response.status === 401) {
    const token = await refreshAccessToken();
    if (token) {
      response = await send(token);
    } else {
      tokenStore.clear();
      onSessionExpired?.();
      throw new ApiError(401, 'Die Sitzung ist abgelaufen. Bitte erneut anmelden.');
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }
  return response;
}

/** Kurzformen für die gängigen Verben. */
export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<T>(path, { query, signal }),
  list: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<Paginated<T>>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  /**
   * Ohne Authentifizierung. Nötig für Anmeldung und Abmeldung: eine 401-Antwort
   * darf dort nicht als abgelaufene Sitzung behandelt werden, sonst verdeckt
   * die Erneuerung die eigentliche Meldung zu falschen Zugangsdaten.
   */
  postAnonymous: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body, anonymous: true }),

  /**
   * Holt eine Datei und öffnet sie in einem neuen Tab. Ein einfacher Verweis
   * würde nicht genügen: die Endpunkte verlangen das Zugangstoken im Kopf, und
   * ein Token im Verweis stünde in der Adresszeile und im Verlauf.
   */
  openFile: async (path: string): Promise<void> => {
    const antwort = await requestRaw(path);
    const blob = await antwort.blob();
    const url = URL.createObjectURL(blob);
    const fenster = window.open(url, '_blank');
    if (!fenster) {
      // Wird das Fenster geblockt, wird stattdessen heruntergeladen.
      const verweis = document.createElement('a');
      verweis.href = url;
      verweis.download = path.split('/').pop() ?? 'beleg.pdf';
      verweis.click();
    }
    // Der Browser braucht den Verweis noch einen Moment.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

  /**
   * Lädt eine Datei herunter, statt sie anzuzeigen. Für Formate, die im
   * Browser nichts zu suchen haben – etwa den Buchungsstapel für die Kanzlei.
   */
  downloadFile: async (path: string, query?: RequestOptions['query']): Promise<void> => {
    const antwort = await requestRaw(path, query);
    const blob = await antwort.blob();
    const url = URL.createObjectURL(blob);

    // Den Dateinamen gibt der Server vor; er trägt den Zeitraum.
    const kopf = antwort.headers.get('Content-Disposition') ?? '';
    const treffer = /filename="?([^";]+)"?/i.exec(kopf);

    const verweis = document.createElement('a');
    verweis.href = url;
    verweis.download = treffer?.[1] ?? path.split('/').pop() ?? 'export';
    verweis.click();

    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};

/** Basisadresse der API, etwa für Download-Verweise. */
export const apiBaseUrl = BASE_URL;
