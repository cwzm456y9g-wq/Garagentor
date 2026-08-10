import type {
  ApiErrorBody,
  AuthTokens,
  AuthUser,
  LoginResponse,
  Paginated,
} from '@garagentor/shared';
import { einreihen, istNetzfehler, uebertragen, type WartendeAnfrage } from './offline';

/**
 * Die API liegt jetzt in derselben Anwendung, unter `/api`.
 *
 * Damit entfällt die Herkunftsprüfung des Browsers vollständig – kein CORS,
 * keine zweite Adresse in der Umgebung, und der Service Worker sieht die
 * Anfragen als eigene. Vorher stand hier eine absolute Adresse auf einen
 * getrennten Dienst.
 */
const BASE_URL = '/api';

const ACCESS_KEY = 'garagentor.accessToken';
const REFRESH_KEY = 'garagentor.refreshToken';
const BENUTZER_KEY = 'garagentor.benutzer';

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
    window.localStorage.removeItem(BENUTZER_KEY);
  },

  /**
   * Der zuletzt bekannte Benutzer.
   *
   * Er liegt neben den Tokens, damit die Anwendung nach einem Neuladen ohne
   * Netz weiß, wer angemeldet ist. Name, Adresse und Rolle stehen ohnehin im
   * Token daneben – hier kommt nichts hinzu, was dort nicht schon stünde.
   */
  get benutzer(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    const roh = window.localStorage.getItem(BENUTZER_KEY);
    if (!roh) return null;
    try {
      return JSON.parse(roh) as AuthUser;
    } catch {
      return null;
    }
  },
  setBenutzer(user: AuthUser): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BENUTZER_KEY, JSON.stringify(user));
  },
};

/** Wird ausgelöst, wenn die Sitzung endgültig abgelaufen ist. */
type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  onSessionExpired = handler;
}

/**
 * Ausgang einer Erneuerung.
 *
 * Der Unterschied zwischen `abgelehnt` und `unerreichbar` ist der wichtige:
 * Nur im ersten Fall hat der Server die Sitzung tatsächlich verweigert. Im
 * zweiten war er schlicht nicht zu erreichen – dann bleiben die Tokens liegen,
 * denn ein Funkloch in einer Halle ist kein Grund, jemanden abzumelden.
 */
type Erneuerung =
  { art: 'erneuert'; token: string } | { art: 'abgelehnt' } | { art: 'unerreichbar' };

/**
 * Läuft gerade eine Erneuerung, warten alle weiteren Anfragen auf dasselbe
 * Ergebnis. Sonst würde jede parallele Anfrage den Refresh-Token einlösen und
 * durch die Rotation die Sitzung der übrigen entwerten.
 */
let refreshInFlight: Promise<Erneuerung> | null = null;

async function refreshAccessToken(): Promise<Erneuerung> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return { art: 'abgelehnt' };

  refreshInFlight ??= (async (): Promise<Erneuerung> => {
    try {
      // Auch hier mit Zeitgrenze: Bleibt die Erneuerung hängen, warten alle
      // übrigen Anfragen auf sie – eine einzige stumme Antwort legte sonst die
      // ganze Oberfläche still.
      const response = await holen(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (response.status === 401 || response.status === 403) {
        tokenStore.clear();
        return { art: 'abgelehnt' };
      }
      // Alles andere (500, 502, 503 …) sagt nichts über die Sitzung aus,
      // sondern über den Server. Die Tokens bleiben unangetastet.
      if (!response.ok) return { art: 'unerreichbar' };

      const tokens = (await response.json()) as LoginResponse;
      tokenStore.set(tokens);
      return { art: 'erneuert', token: tokens.accessToken };
    } catch {
      return { art: 'unerreichbar' };
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
  /**
   * Darf ohne Netz in die Warteschlange wandern.
   *
   * Nur für Arbeiten vor Ort gedacht. Der Text beschreibt den Vorgang in der
   * Übersicht der wartenden Übertragungen.
   */
  offline?: string;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Wie lange auf den Server gewartet wird, bevor eine Anfrage abgebrochen wird.
 *
 * Ohne diese Grenze wartet `fetch` unbegrenzt. Für den Bedienenden sieht das
 * aus wie ein Knopf, der sich dreht und dreht: Keine Meldung, kein Fehler,
 * nichts zum Weitermachen. Genau daran hing die Anmeldung fest, als der Server
 * zwar antwortete, aber die Datenbank nicht.
 *
 * Dreißig Sekunden sind reichlich – die Datenbankverbindung gibt schon nach
 * zehn auf, und der Webserver bricht bei sechzig ab. Diese Grenze liegt
 * dazwischen, damit die Meldung von der Anwendung kommt und nicht als nackte
 * Fehlerseite vom Webserver.
 */
const GEDULD_MS = 30_000;

/**
 * Verbindet eine eigene Zeitgrenze mit einem etwaigen Abbruchsignal des
 * Aufrufers und sagt hinterher, welches von beiden zugeschlagen hat.
 *
 * Die Unterscheidung ist nötig: Ein vom Aufrufer abgebrochener Aufruf – etwa
 * weil die Seite gewechselt wurde – ist kein Fehler und darf keine Meldung
 * erzeugen. Eine abgelaufene Zeitgrenze ist einer.
 */
function mitZeitgrenze(vorgegeben: AbortSignal | undefined, grenzeMs: number) {
  const steuerung = new AbortController();
  let durchZeit = false;

  const zeitgeber = setTimeout(() => {
    durchZeit = true;
    steuerung.abort();
  }, grenzeMs);

  const weiterreichen = () => steuerung.abort();
  vorgegeben?.addEventListener('abort', weiterreichen);

  return {
    signal: steuerung.signal,
    abgelaufen: () => durchZeit,
    freigeben: () => {
      clearTimeout(zeitgeber);
      vorgegeben?.removeEventListener('abort', weiterreichen);
    },
  };
}

/** Die Meldung, die statt des ewig drehenden Rädchens erscheint. */
function zeitgrenzeUeberschritten(): ApiError {
  return new ApiError(
    504,
    `Der Server hat innerhalb von ${GEDULD_MS / 1000} Sekunden nicht geantwortet. Bitte erneut versuchen; bleibt es dabei, stimmt etwas mit dem Server oder der Datenbank nicht.`,
  );
}

/** Schickt eine Anfrage mit Zeitgrenze und übersetzt deren Ablauf in einen Fehler. */
async function holen(eingabe: string, optionen: RequestInit, vorgegeben?: AbortSignal) {
  const bund = mitZeitgrenze(vorgegeben, GEDULD_MS);
  try {
    return await fetch(eingabe, { ...optionen, signal: bund.signal });
  } catch (fehler) {
    // Nur die eigene Zeitgrenze wird zur Meldung. Ein Abbruch des Aufrufers
    // fliegt unverändert weiter, damit ihn niemand für einen Ausfall hält.
    if (bund.abgelaufen()) throw zeitgrenzeUeberschritten();
    throw fehler;
  } finally {
    bund.freigeben();
  }
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

    return holen(
      buildUrl(path, options.query),
      {
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
      },
      options.signal,
    );
  };

  let response: Response;
  try {
    response = await send(options.anonymous ? null : tokenStore.access);
  } catch (fehler) {
    // Kein Netz. Arbeiten vor Ort warten in der Warteschlange, alles andere
    // meldet den Fehlschlag – eine erfundene Erfolgsmeldung wäre schlimmer.
    if (options.offline && istNetzfehler(fehler)) {
      await inWarteschlange(path, options);
      return undefined as T;
    }
    throw fehler;
  }

  if (response.status === 401 && !options.anonymous) {
    const erneuerung = await refreshAccessToken();
    if (erneuerung.art === 'erneuert') {
      response = await send(erneuerung.token);
    } else if (erneuerung.art === 'abgelehnt') {
      tokenStore.clear();
      onSessionExpired?.();
      throw new ApiError(401, 'Die Sitzung ist abgelaufen. Bitte erneut anmelden.');
    } else {
      // Der Server war für die Erneuerung nicht zu erreichen. Die Sitzung
      // gilt weiter; gemeldet wird der Ausfall, nicht das Abgemeldetsein.
      throw new ApiError(
        503,
        'Der Server ist gerade nicht erreichbar. Bitte in einem Moment erneut versuchen.',
      );
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
 * Legt eine Anfrage für später ab. FormData wird auseinandergenommen, weil
 * IndexedDB damit nichts anfangen kann – der Blob überlebt, die Felder auch.
 */
async function inWarteschlange(path: string, options: RequestOptions): Promise<void> {
  const methode = (options.method ?? 'POST') as WartendeAnfrage['methode'];

  if (options.body instanceof FormData) {
    const form = options.body;
    const felder: Record<string, string> = {};
    let datei: { feld: string; blob: Blob; name: string } | null = null;

    for (const [schluessel, wert] of form.entries()) {
      if (wert instanceof File) datei = { feld: schluessel, blob: wert, name: wert.name };
      else felder[schluessel] = wert;
    }
    if (!datei) throw new Error('Ohne Datei lässt sich der Upload nicht vormerken.');

    await einreihen({
      bezeichnung: options.offline!,
      pfad: path,
      methode,
      datei: { ...datei, felder },
    });
    return;
  }

  await einreihen({
    bezeichnung: options.offline!,
    pfad: path,
    methode,
    rumpf: options.body,
  });
}

/**
 * Schickt einen wartenden Eintrag hinaus. Wird von der Anzeige der
 * Warteschlange aufgerufen, sobald wieder Netz da ist.
 */
export function warteschlangeUebertragen() {
  return uebertragen(async (eintrag) => {
    if (eintrag.datei) {
      const form = new FormData();
      form.append(eintrag.datei.feld, eintrag.datei.blob, eintrag.datei.name);
      for (const [schluessel, wert] of Object.entries(eintrag.datei.felder)) {
        form.append(schluessel, wert);
      }
      await request(eintrag.pfad, { method: eintrag.methode, body: form });
      return;
    }
    await request(eintrag.pfad, { method: eintrag.methode, body: eintrag.rumpf });
  });
}

/**
 * Wie `request`, gibt aber die Antwort selbst zurück – für Dateien, die nicht
 * als JSON ausgewertet werden. Token und Erneuerung laufen gleich.
 */
export async function requestRaw(path: string, query?: RequestOptions['query']): Promise<Response> {
  const send = (token: string | null) =>
    holen(buildUrl(path, query), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  let response = await send(tokenStore.access);

  if (response.status === 401) {
    const erneuerung = await refreshAccessToken();
    if (erneuerung.art === 'erneuert') {
      response = await send(erneuerung.token);
    } else if (erneuerung.art === 'abgelehnt') {
      tokenStore.clear();
      onSessionExpired?.();
      throw new ApiError(401, 'Die Sitzung ist abgelaufen. Bitte erneut anmelden.');
    } else {
      throw new ApiError(
        503,
        'Der Server ist gerade nicht erreichbar. Bitte in einem Moment erneut versuchen.',
      );
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

  /**
   * Wie post/patch, darf aber ohne Netz warten. Nur für Arbeiten vor Ort –
   * `bezeichnung` steht danach in der Liste der wartenden Übertragungen.
   */
  postOffline: <T>(path: string, body: unknown, bezeichnung: string) =>
    request<T>(path, { method: 'POST', body, offline: bezeichnung }),
  patchOffline: <T>(path: string, body: unknown, bezeichnung: string) =>
    request<T>(path, { method: 'PATCH', body, offline: bezeichnung }),
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
