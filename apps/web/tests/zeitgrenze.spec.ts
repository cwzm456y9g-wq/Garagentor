import { ApiError, request } from '@/lib/api-client';

/**
 * Ohne Zeitgrenze wartet `fetch` unbegrenzt. Für den Bedienenden sieht das aus
 * wie ein Knopf, der sich dreht und dreht – keine Meldung, kein Fehler, nichts
 * zum Weitermachen. Genau daran hing die Anmeldung fest, als der Server zwar
 * antwortete, aber die Datenbank nicht.
 */
describe('Zeitgrenze der API-Anfragen', () => {
  const urspruenglichesFetch = globalThis.fetch;

  beforeAll(() => {
    // `buildUrl` braucht eine Herkunft, `tokenStore` eine Ablage. Mehr nicht.
    (globalThis as unknown as { window: unknown }).window = {
      location: { origin: 'https://beispiel.test' },
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    };
  });

  afterAll(() => {
    globalThis.fetch = urspruenglichesFetch;
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /** Ein Server, der die Verbindung annimmt und dann schweigt. */
  function schweigenderServer() {
    globalThis.fetch = ((_eingabe: unknown, init?: RequestInit) =>
      new Promise((_, ablehnen) => {
        init?.signal?.addEventListener('abort', () =>
          ablehnen(new DOMException('Abgebrochen', 'AbortError')),
        );
      })) as typeof fetch;
  }

  it('bricht nach dreißig Sekunden ab und sagt, was los ist', async () => {
    schweigenderServer();

    const versuch = request('/auth/login', {
      method: 'POST',
      body: { email: 'a@b.de', password: 'geheim' },
      anonymous: true,
    });
    const erwartung = expect(versuch).rejects.toMatchObject({
      status: 504,
      message: expect.stringContaining('30 Sekunden'),
    });

    await jest.advanceTimersByTimeAsync(30_000);
    await erwartung;
  });

  it('wartet vorher wirklich – nach 29 Sekunden steht die Anfrage noch', async () => {
    schweigenderServer();

    let entschieden = false;
    const versuch = request('/auth/login', { method: 'POST', anonymous: true }).catch(
      () => (entschieden = true),
    );

    await jest.advanceTimersByTimeAsync(29_000);
    expect(entschieden).toBe(false);

    await jest.advanceTimersByTimeAsync(2_000);
    await versuch;
    expect(entschieden).toBe(true);
  });

  it('lässt einen Abbruch des Aufrufers unverändert durch', async () => {
    // Ein Seitenwechsel bricht laufende Anfragen ab. Das ist kein Ausfall und
    // darf keine Fehlermeldung erzeugen – sonst meldet die Oberfläche einen
    // Serverfehler, weil jemand weitergeklickt hat.
    schweigenderServer();
    const steuerung = new AbortController();

    const versuch = request('/customers', { signal: steuerung.signal }).catch(
      (fehler: unknown) => fehler,
    );

    steuerung.abort();
    const fehler = await versuch;

    expect((fehler as Error).name).toBe('AbortError');
    expect(fehler).not.toBeInstanceOf(ApiError);
  });

  it('lässt eine rechtzeitige Antwort in Ruhe', async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ accessToken: 'abc' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )) as typeof fetch;

    await expect(request('/auth/login', { method: 'POST', anonymous: true })).resolves.toEqual({
      accessToken: 'abc',
    });
  });
});
