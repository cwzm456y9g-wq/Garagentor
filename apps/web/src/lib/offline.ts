'use client';

/**
 * Warteschlange für Arbeiten ohne Netz.
 *
 * Was der Monteur in der Tiefgarage einträgt, darf nicht verloren gehen, nur
 * weil dort kein Empfang ist. Solche Anfragen landen deshalb in einer Ablage
 * im Browser und gehen hinaus, sobald wieder eine Verbindung besteht.
 *
 * Bewusst nicht für alles: eine Rechnung, die man für gestellt hält, obwohl
 * sie nur im Browser liegt, wäre schlimmer als eine Fehlermeldung. Nur die
 * Arbeiten vor Ort – Prüfergebnisse, Abschlüsse, Fotos – dürfen warten, und
 * die Oberfläche sagt jederzeit, wie viele es sind.
 */

const DATENBANK = 'garagentor-offline';
const SPEICHER = 'warteschlange';

export interface WartendeAnfrage {
  id?: number;
  /** Beschreibung für die Anzeige, z. B. „Prüfergebnisse PR-2026-0004“. */
  bezeichnung: string;
  pfad: string;
  methode: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON-Rumpf; bei Dateien steht stattdessen `datei`. */
  rumpf?: unknown;
  datei?: { feld: string; blob: Blob; name: string; felder: Record<string, string> };
  erstellt: number;
  /** Letzter Fehlschlag, damit die Oberfläche ihn zeigen kann. */
  fehler?: string;
}

function oeffnen(): Promise<IDBDatabase> {
  return new Promise((erfuellen, ablehnen) => {
    const anfrage = indexedDB.open(DATENBANK, 1);
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result;
      if (!db.objectStoreNames.contains(SPEICHER)) {
        db.createObjectStore(SPEICHER, { keyPath: 'id', autoIncrement: true });
      }
    };
    anfrage.onsuccess = () => erfuellen(anfrage.result);
    anfrage.onerror = () => ablehnen(anfrage.error);
  });
}

function alsPromise<T>(anfrage: IDBRequest<T>): Promise<T> {
  return new Promise((erfuellen, ablehnen) => {
    anfrage.onsuccess = () => erfuellen(anfrage.result);
    anfrage.onerror = () => ablehnen(anfrage.error);
  });
}

export async function einreihen(eintrag: Omit<WartendeAnfrage, 'id' | 'erstellt'>): Promise<void> {
  const db = await oeffnen();
  const geschaeft = db.transaction(SPEICHER, 'readwrite');
  geschaeft.objectStore(SPEICHER).add({ ...eintrag, erstellt: Date.now() });
  await new Promise((erfuellen) => {
    geschaeft.oncomplete = () => erfuellen(undefined);
  });
  db.close();
  melden();
}

export async function wartende(): Promise<WartendeAnfrage[]> {
  if (typeof indexedDB === 'undefined') return [];
  const db = await oeffnen();
  const alle = await alsPromise(
    db.transaction(SPEICHER, 'readonly').objectStore(SPEICHER).getAll() as IDBRequest<
      WartendeAnfrage[]
    >,
  );
  db.close();
  return alle.sort((a, b) => a.erstellt - b.erstellt);
}

async function entfernen(id: number): Promise<void> {
  const db = await oeffnen();
  db.transaction(SPEICHER, 'readwrite').objectStore(SPEICHER).delete(id);
  db.close();
}

async function fehlerVermerken(eintrag: WartendeAnfrage, fehler: string): Promise<void> {
  const db = await oeffnen();
  db.transaction(SPEICHER, 'readwrite')
    .objectStore(SPEICHER)
    .put({ ...eintrag, fehler });
  db.close();
}

/* Benachrichtigung ------------------------------------------------------ */

type Zuhoerer = () => void;
const zuhoerer = new Set<Zuhoerer>();

export function beiAenderung(hoerer: Zuhoerer): () => void {
  zuhoerer.add(hoerer);
  return () => zuhoerer.delete(hoerer);
}

function melden(): void {
  for (const hoerer of zuhoerer) hoerer();
}

/* Übertragung ----------------------------------------------------------- */

let laeuftGerade = false;

export interface UebertragungsErgebnis {
  uebertragen: number;
  verblieben: number;
}

/**
 * Arbeitet die Warteschlange der Reihe nach ab.
 *
 * Die Reihenfolge zählt: erst die Prüfergebnisse, dann der Abschluss. Deshalb
 * bricht der Lauf beim ersten Fehlschlag ab, statt die übrigen Einträge
 * vorzuziehen – ein Abschluss ohne die Ergebnisse davor wäre falsch.
 */
export async function uebertragen(
  senden: (eintrag: WartendeAnfrage) => Promise<void>,
): Promise<UebertragungsErgebnis> {
  if (laeuftGerade) return { uebertragen: 0, verblieben: (await wartende()).length };
  laeuftGerade = true;

  let erledigt = 0;
  try {
    const liste = await wartende();
    for (const eintrag of liste) {
      try {
        await senden(eintrag);
        if (eintrag.id !== undefined) await entfernen(eintrag.id);
        erledigt += 1;
      } catch (fehler) {
        await fehlerVermerken(
          eintrag,
          fehler instanceof Error ? fehler.message : 'Übertragung fehlgeschlagen',
        );
        break;
      }
    }
  } finally {
    laeuftGerade = false;
    melden();
  }

  return { uebertragen: erledigt, verblieben: (await wartende()).length };
}

/* Zustand des Netzes ---------------------------------------------------- */

export function istOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Ob ein Fehler daher kommt, dass keine Verbindung besteht.
 *
 * `fetch` wirft bei fehlendem Netz einen TypeError ohne Statuscode – im
 * Unterschied zu einer Antwort des Servers, die auch bei 500 eine ist.
 */
export function istNetzfehler(fehler: unknown): boolean {
  if (istOffline()) return true;
  return fehler instanceof TypeError;
}
