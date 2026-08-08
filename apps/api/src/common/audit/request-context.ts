import { AsyncLocalStorage } from 'node:async_hooks';

/** Was während einer Anfrage über den Aufrufer bekannt ist. */
export interface RequestContext {
  userId?: string;
}

/**
 * Trägt den angemeldeten Benutzer durch den Aufrufbaum, ohne ihn durch jede
 * Signatur zu schleifen. Nötig fürs Änderungsprotokoll: die Dienste kennen
 * ihren Aufrufer sonst nicht, und ihn überall zu ergänzen hieße, Dutzende
 * Methoden nur wegen einer Nebenbuchung anzufassen.
 *
 * Geplante Läufe – etwa der Mahnlauf über den Zeitplan – laufen ohne Kontext;
 * dort bleibt das Protokoll ohne Benutzer, was richtig ist.
 */
const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentUserId(): string | undefined {
  return storage.getStore()?.userId;
}
