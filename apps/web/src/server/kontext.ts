import { AsyncLocalStorage } from 'node:async_hooks';

/** Was während einer Anfrage über den Aufrufer bekannt ist. */
export interface Anfragekontext {
  benutzerId?: string;
}

/**
 * Trägt den angemeldeten Benutzer durch den Aufrufbaum, ohne ihn durch jede
 * Signatur zu schleifen. Nötig fürs Änderungsprotokoll: die Dienste kennen
 * ihren Aufrufer sonst nicht, und ihn überall zu ergänzen hieße, Dutzende
 * Methoden nur wegen einer Nebenbuchung anzufassen.
 *
 * Die nächtlichen Läufe – etwa der Mahnlauf – kommen ohne Kontext; dort bleibt
 * das Protokoll ohne Benutzer, was richtig ist.
 */
const ablage = new AsyncLocalStorage<Anfragekontext>();

export function mitKontext<T>(kontext: Anfragekontext, fn: () => T): T {
  return ablage.run(kontext, fn);
}

export function aktuelleBenutzerId(): string | undefined {
  return ablage.getStore()?.benutzerId;
}
