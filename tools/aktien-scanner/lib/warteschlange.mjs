/**
 * Zwei kleine Helfer für den Umgang mit einer fremden Schnittstelle, die man
 * nicht überrennen darf.
 */

/** Wartet `ms` Millisekunden. */
export const warte = (ms) => new Promise((fertig) => setTimeout(fertig, ms));

/**
 * Arbeitet eine Liste mit höchstens `gleichzeitig` parallelen Aufgaben ab.
 *
 * Kein `Promise.all` über alles: Bei ein paar tausend Symbolen wären das ein
 * paar tausend gleichzeitige Verbindungen. Der Anbieter antwortet dann mit 429
 * und sperrt für Minuten – der Lauf dauert am Ende länger als mit Bremse.
 *
 * `beiFortschritt` wird nach jeder erledigten Aufgabe aufgerufen und bekommt
 * die Zahl der fertigen und die der gesamten Aufgaben.
 */
export async function nacheinander(elemente, gleichzeitig, aufgabe, beiFortschritt) {
  const ergebnisse = new Array(elemente.length);
  let naechster = 0;
  let fertig = 0;

  const arbeiter = async () => {
    for (;;) {
      const index = naechster++;
      if (index >= elemente.length) return;
      try {
        ergebnisse[index] = await aufgabe(elemente[index], index);
      } catch (fehler) {
        ergebnisse[index] = { fehler };
      }
      fertig++;
      beiFortschritt?.(fertig, elemente.length);
    }
  };

  const anzahl = Math.max(1, Math.min(gleichzeitig, elemente.length));
  await Promise.all(Array.from({ length: anzahl }, arbeiter));
  return ergebnisse;
}

/**
 * Wiederholt einen Aufruf bei vorübergehenden Störungen mit wachsender Pause.
 *
 * Wachsend, weil eine feste kurze Pause bei einer Ratenbremse nichts hilft:
 * Alle Arbeiter kämen im selben Takt wieder und würden dieselbe Sperre
 * erneut auslösen. Der Zufallsanteil verhindert, dass sie sich synchronisieren.
 */
export async function mitWiederholung(aufruf, { versuche = 4, grundpause = 800 } = {}) {
  let letzterFehler;
  for (let versuch = 0; versuch < versuche; versuch++) {
    try {
      return await aufruf(versuch);
    } catch (fehler) {
      letzterFehler = fehler;
      if (fehler?.endgueltig) throw fehler;
      if (versuch === versuche - 1) break;
      await warte(grundpause * 2 ** versuch + Math.random() * 400);
    }
  }
  throw letzterFehler;
}
