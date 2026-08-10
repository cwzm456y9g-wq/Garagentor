import { randomBytes } from 'node:crypto';
import { argon2id, argon2Verify } from 'hash-wasm';

/**
 * Passwörter hashen und prüfen – mit Argon2id, auf zwei Wegen.
 *
 * Bevorzugt läuft das kompilierte `argon2`: schnell, seit Jahren erprobt.
 * Es hat aber eine Eigenschaft, die uns beim ersten Ausrollen eingeholt hat –
 * es ist gegen eine bestimmte Systembibliothek gebaut. Das Paket entsteht hier
 * und läuft dort; verlangt es GLIBC 2.34 und der Server hat 2.28, lädt es
 * nicht. Bei Hostingers Webhosting ist genau das zu erwarten: Der Server dort
 * ist alt genug, dass schon Prisma seine passende Bibliothek brauchte.
 *
 * Deshalb liegt daneben dieselbe Rechnung als WebAssembly. Die läuft überall,
 * weil sie nichts vom Betriebssystem will. Sie ist langsamer – für ein paar
 * Anmeldungen am Tag ohne Belang.
 *
 * Beide erzeugen und lesen dasselbe Format
 * (`$argon2id$v=19$m=65536,t=3,p=4$…`). Nachgemessen: Ein vom kompilierten
 * Modul erzeugter Hash wird von WebAssembly bestätigt und umgekehrt, falsche
 * Passwörter fallen in beiden Richtungen durch. Ein Wechsel des Weges sperrt
 * also niemanden aus.
 */

/** Dieselben Parameter, die das kompilierte `argon2` voreingestellt nutzt. */
const PARAMETER = { parallelism: 4, memorySize: 65536, iterations: 3, hashLength: 32 } as const;

interface Argon2Modul {
  hash(passwort: string, optionen: { type: number }): Promise<string>;
  verify(hash: string, passwort: string): Promise<boolean>;
  argon2id: number;
}

/**
 * Der Ladeversuch gehört in ein try/catch: Passt die Bibliothek nicht zum
 * System, wirft schon das Laden – nicht erst der erste Aufruf. Ohne diese
 * Klammer risse es die ganze Anmeldung mit.
 *
 * Bewusst `require` und nicht `import`: Ein `import` lässt sich nicht
 * umklammern, und beide Umgebungen, in denen diese Datei läuft – der
 * Serverbau von Next.js und die Tests – arbeiten mit CommonJS. Nebenbei sieht
 * der Bau den Aufruf und legt das Modul mit ins Paket.
 */
const nativ: Argon2Modul | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('argon2') as Argon2Modul;
  } catch {
    return null;
  }
})();

export function hashVerfahren(): 'nativ' | 'webassembly' {
  return nativ ? 'nativ' : 'webassembly';
}

export async function passwortHashen(passwort: string): Promise<string> {
  if (nativ) return nativ.hash(passwort, { type: nativ.argon2id });
  return argon2id({
    password: passwort,
    salt: randomBytes(16),
    outputType: 'encoded',
    ...PARAMETER,
  });
}

/**
 * Gibt bei jedem Fehler `false` zurück – ein beschädigter Hash in der
 * Datenbank darf keine Ausnahme werden, sondern eine abgelehnte Anmeldung.
 */
export async function passwortPruefen(hash: string, passwort: string): Promise<boolean> {
  try {
    if (nativ) return await nativ.verify(hash, passwort);
    return await argon2Verify({ password: passwort, hash });
  } catch {
    return false;
  }
}

/**
 * Ein Hash über Zufall, gegen den bei unbekannter Adresse geprüft wird.
 *
 * Ohne ihn verriete die Antwortzeit, ob ein Konto existiert: Bei einer
 * unbekannten Adresse käme die Absage sofort, bei einer bekannten erst nach
 * der Prüfung.
 */
export function blindHash(): Promise<string> {
  return passwortHashen(randomBytes(24).toString('hex'));
}
