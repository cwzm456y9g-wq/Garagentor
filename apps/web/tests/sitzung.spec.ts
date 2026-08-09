/**
 * Wann eine Sitzung enden darf – und wann nicht.
 *
 * Anlass ist ein Fehler, der beim Probelauf gegen das fertige Paket auffiel:
 * Ein einziger abgebrochener Aufruf – ein Funkloch in der Halle genügt – warf
 * die Tokens weg und meldete den Monteur mitten in der Arbeit ab. Danach half
 * nur noch eine neue Anmeldung, obwohl die Sitzung nie ungültig war.
 *
 * Die Regel lautet seither: Nur eine Absage des Servers (401/403) beendet die
 * Sitzung. Ein Ausfall sagt nichts über sie aus.
 */

interface Ablage {
  [schluessel: string]: string;
}

let ablage: Ablage = {};

const localStorageStub = {
  getItem: (k: string) => ablage[k] ?? null,
  setItem: (k: string, v: string) => {
    ablage[k] = v;
  },
  removeItem: (k: string) => {
    delete ablage[k];
  },
};

// api-client läuft im Browser. Für den Test genügen die zwei Dinge, die es
// von dort tatsächlich anfasst: die Ablage und die eigene Adresse.
(globalThis as unknown as { window: unknown }).window = {
  localStorage: localStorageStub,
  location: { origin: 'https://beispiel.test' },
};

import { ApiError, request, tokenStore } from '@/lib/api-client';

const ZUGANG = 'garagentor.accessToken';
const ERNEUERUNG = 'garagentor.refreshToken';

/** Antworten der Reihe nach; jede Anfrage nimmt die nächste. */
function antwortenNacheinander(antworten: Array<Response | Error>): jest.Mock {
  const mock = jest.fn(() => {
    const naechste = antworten.shift();
    if (!naechste) throw new Error('Unerwartet viele Aufrufe.');
    if (naechste instanceof Error) return Promise.reject(naechste);
    return Promise.resolve(naechste);
  });
  (globalThis as unknown as { fetch: unknown }).fetch = mock;
  return mock;
}

function antwort(status: number, rumpf: unknown = {}): Response {
  return new Response(JSON.stringify(rumpf), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(async () => {
  ablage = { [ZUGANG]: 'alter-zugang', [ERNEUERUNG]: 'alte-erneuerung' };
  // Die laufende Erneuerung wird per queueMicrotask freigegeben; ohne diesen
  // Umlauf sähe der nächste Test noch das Ergebnis des vorigen.
  await new Promise((f) => setTimeout(f, 0));
});

describe('Sitzung bei abgelehnter Erneuerung', () => {
  it('verwirft die Tokens, wenn der Server den Refresh-Token ablehnt', async () => {
    antwortenNacheinander([antwort(401), antwort(401)]);

    await expect(request('/customers')).rejects.toMatchObject({ status: 401 });
    expect(tokenStore.access).toBeNull();
    expect(tokenStore.refresh).toBeNull();
  });
});

describe('Sitzung bei gestörtem Server', () => {
  it('behält die Tokens, wenn die Erneuerung im Netz hängen bleibt', async () => {
    // Ein abgebrochener fetch wirft einen TypeError – genau das passiert im
    // Funkloch. Er darf nicht wie eine Absage behandelt werden.
    antwortenNacheinander([antwort(401), new TypeError('Failed to fetch')]);

    await expect(request('/customers')).rejects.toMatchObject({ status: 503 });
    expect(tokenStore.access).toBe('alter-zugang');
    expect(tokenStore.refresh).toBe('alte-erneuerung');
  });

  it('behält die Tokens, wenn die Erneuerung mit 503 antwortet', async () => {
    antwortenNacheinander([antwort(401), antwort(503)]);

    await expect(request('/customers')).rejects.toMatchObject({ status: 503 });
    expect(tokenStore.access).toBe('alter-zugang');
  });

  it('behält die Tokens, wenn die Erneuerung mit 500 antwortet', async () => {
    antwortenNacheinander([antwort(401), antwort(500)]);

    await expect(request('/customers')).rejects.toBeInstanceOf(ApiError);
    expect(tokenStore.access).toBe('alter-zugang');
  });
});

describe('Erfolgreiche Erneuerung', () => {
  it('wiederholt die Anfrage mit dem neuen Token', async () => {
    const mock = antwortenNacheinander([
      antwort(401),
      antwort(200, {
        accessToken: 'neuer-zugang',
        refreshToken: 'neue-erneuerung',
        user: { id: 'u1' },
      }),
      antwort(200, { items: [] }),
    ]);

    await expect(request('/customers')).resolves.toEqual({ items: [] });
    expect(tokenStore.access).toBe('neuer-zugang');
    expect(tokenStore.refresh).toBe('neue-erneuerung');

    const letzter = mock.mock.calls[2][1] as RequestInit;
    expect((letzter.headers as Record<string, string>).Authorization).toBe('Bearer neuer-zugang');
  });
});

describe('Zwischenstand des Benutzers', () => {
  it('wird mit den Tokens zusammen verworfen', () => {
    tokenStore.setBenutzer({ id: 'u1', email: 'a@b.test', role: 'ADMIN' } as never);
    expect(tokenStore.benutzer).toMatchObject({ id: 'u1' });

    tokenStore.clear();
    // Sonst sähe auf einem geteilten Tablet die nächste Person, wer zuletzt
    // angemeldet war.
    expect(tokenStore.benutzer).toBeNull();
  });

  it('übersteht einen beschädigten Eintrag, ohne zu werfen', () => {
    ablage['garagentor.benutzer'] = '{kein json';
    expect(tokenStore.benutzer).toBeNull();
  });
});
