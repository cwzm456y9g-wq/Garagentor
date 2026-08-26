/*
 * Zwischenspeicher für den Einsatz ohne Netz.
 *
 * In der Tiefgarage oder im Werkhallenkeller ist oft kein Empfang. Damit die
 * Prüfung dort nicht abbricht, hält dieser Dienst zwei Dinge vor: die Seiten
 * selbst und die zuletzt geladenen Daten. Geschrieben wird nicht hier, sondern
 * in einer Warteschlange im Browser – siehe lib/offline.ts.
 *
 * Bewusst von Hand geschrieben statt über ein Zusatzpaket: der Umfang ist
 * klein, und was in einem Handwerksbetrieb offline funktionieren muss, will
 * man nachlesen können.
 */

const VERSION = 'v1';
const SEITEN = `garagentor-seiten-${VERSION}`;
const MITTEL = `garagentor-mittel-${VERSION}`;
const DATEN = `garagentor-daten-${VERSION}`;

self.addEventListener('install', (event) => {
  // Sofort übernehmen: eine neue Fassung soll nicht warten, bis alle
  // Fenster geschlossen sind.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const namen = await caches.keys();
      await Promise.all(
        namen
          .filter((name) => name.startsWith('garagentor-') && !name.endsWith(VERSION))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Antwort aus dem Netz holen und ablegen; scheitert das, aus dem Speicher. */
async function netzZuerst(request, speicher) {
  const cache = await caches.open(speicher);
  try {
    const antwort = await fetch(request);
    // Nur brauchbare Antworten ablegen. Eine 401 als Vorrat wäre schlimmer
    // als gar keine: sie würde beim nächsten Mal die Anmeldung vortäuschen.
    if (antwort.ok) await cache.put(request, antwort.clone());
    return antwort;
  } catch (fehler) {
    const abgelegt = await cache.match(request);
    if (abgelegt) return abgelegt;
    throw fehler;
  }
}

/** Aus dem Speicher liefern und im Hintergrund erneuern. */
async function speicherZuerst(request, speicher) {
  const cache = await caches.open(speicher);
  const abgelegt = await cache.match(request);
  if (abgelegt) return abgelegt;

  const antwort = await fetch(request);
  if (antwort.ok) await cache.put(request, antwort.clone());
  return antwort;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Geschrieben wird nie über den Zwischenspeicher: was hinausgeht, gehört in
  // die Warteschlange der Anwendung, damit der Benutzer es sieht.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(netzZuerst(request, SEITEN));
    return;
  }

  // Die Bausteine von Next tragen einen Prüfsummennamen und ändern sich nie.
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(speicherZuerst(request, MITTEL));
    return;
  }

  // Daten der Schnittstelle: frisch, wenn es geht; sonst der letzte Stand.
  if (url.pathname.includes('/api/')) {
    event.respondWith(netzZuerst(request, DATEN));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(netzZuerst(request, MITTEL));
  }
});

/**
 * Die Anwendung meldet sich, wenn sie Daten für unterwegs vorlädt. Der Umweg
 * über den Dienst stellt sicher, dass die Antworten im selben Speicher landen,
 * aus dem später offline gelesen wird.
 */
self.addEventListener('message', (event) => {
  const nachricht = event.data;
  if (!nachricht) return;

  /*
   * Beim Abmelden werden die Daten verworfen.
   *
   * Die abgelegten Antworten hängen an der Adresse, nicht am Zugangstoken.
   * Ohne dieses Leeren könnte auf einem geteilten Tablet die nächste Person
   * den Stand der vorigen sehen.
   */
  if (nachricht.art === 'leeren') {
    event.waitUntil(caches.delete(DATEN).then(() => caches.delete(SEITEN)));
    return;
  }

  if (nachricht.art !== 'vorladen' || !Array.isArray(nachricht.anfragen)) return;

  event.waitUntil(
    (async () => {
      const cache = await caches.open(DATEN);
      for (const eintrag of nachricht.anfragen) {
        try {
          const request = new Request(eintrag.url, { headers: eintrag.headers ?? {} });
          const antwort = await fetch(request);
          if (antwort.ok) await cache.put(new Request(eintrag.url), antwort.clone());
        } catch {
          // Ein einzelner Fehlschlag darf das Vorladen nicht abbrechen.
        }
      }
    })(),
  );
});
