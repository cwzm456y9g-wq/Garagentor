'use client';

/**
 * An- und Abmeldung des Zwischenspeichers für den Betrieb ohne Netz.
 *
 * Nur im fertigen Bau: in der Entwicklung liefert Next die Bausteine bei jeder
 * Änderung neu aus, und ein Zwischenspeicher davor würde alte Fassungen
 * festhalten.
 */

export function dienstAnmelden(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (process.env.NODE_ENV !== 'production') return;

  void navigator.serviceWorker.register('/sw.js').catch(() => {
    // Ohne Zwischenspeicher läuft die Anwendung weiter, nur eben mit Netz.
  });
}

/** Verwirft die abgelegten Daten – gehört zum Abmelden. */
export async function dienstDatenVerwerfen(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const anmeldung = await navigator.serviceWorker.getRegistration();
  anmeldung?.active?.postMessage({ art: 'leeren' });
}

/**
 * Lädt Daten für unterwegs vor, damit sie später auch ohne Netz dastehen.
 *
 * Der Umweg über den Dienst ist nötig, weil nur er in den Speicher schreiben
 * kann, aus dem die Anwendung offline liest.
 */
export async function fuerUnterwegsLaden(urls: string[], token: string | null): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;

  const anmeldung = await navigator.serviceWorker.getRegistration();
  const dienst = anmeldung?.active;
  if (!dienst) return false;

  dienst.postMessage({
    art: 'vorladen',
    anfragen: urls.map((url) => ({
      url,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })),
  });
  return true;
}
