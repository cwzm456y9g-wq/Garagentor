/**
 * Sammelsetzen von Prüfpunkten.
 *
 * Eine Prüfung nach ASR A1.7 hat 31 Punkte, und bei einer gepflegten Anlage
 * sind 31 davon in Ordnung. Jeden einzeln aus einem Auswahlfeld zu holen, ist
 * die Art von Arbeit, die dazu führt, daß am Ende gar nicht mehr richtig
 * geprüft wird.
 *
 * Zwei Regeln machen den Sammelgriff dennoch vertretbar, und beide sind hier
 * gekapselt, damit sie sich prüfen lassen:
 *
 * Ein bereits beurteilter Punkt bleibt, wie er ist. Wer einen Mangel
 * eingetragen hat, darf ihn nicht durch einen Griff verlieren.
 *
 * Ein Punkt mit Grenzwert bleibt offen, solange kein Meßwert dasteht. Diese
 * drei Punkte – Schließkraft, Restkraft, Dauer nach DIN EN 12453 – sind der
 * Kern der Prüfung. „In Ordnung" ohne Zahl wäre eine behauptete Messung.
 */

/** Was von einem Prüfpunkt für die Entscheidung zählt. */
export interface Punkt {
  key: string;
  /** Grenzwert; gesetzt heißt: hier wird gemessen. */
  limitValue?: number | null;
}

/** Der Eingabestand eines Punktes vor dem Speichern. */
export interface Stand {
  result: string;
  measuredValue: string;
}

/** Punkte, die noch niemand beurteilt hat. */
export function offenePunkte<T extends Punkt>(
  punkte: T[],
  staende: Record<string, Stand | undefined>,
): T[] {
  return punkte.filter(
    (punkt) => (staende[punkt.key]?.result ?? 'NICHT_GEPRUEFT') === 'NICHT_GEPRUEFT',
  );
}

/** Offene Punkte, die auf einen Meßwert warten. */
export function fehlendeMesswerte<T extends Punkt>(
  punkte: T[],
  staende: Record<string, Stand | undefined>,
): T[] {
  return offenePunkte(punkte, staende).filter(
    (punkt) => punkt.limitValue != null && !staende[punkt.key]?.measuredValue,
  );
}

/**
 * Setzt die offenen Punkte auf „in Ordnung" und gibt den neuen Stand zurück.
 *
 * Die Funktion verändert nichts, sondern liefert eine neue Zuordnung – so
 * bleibt sie prüfbar und paßt zugleich zu React.
 */
export function aufOkSetzen<T extends Punkt>(
  punkte: T[],
  staende: Record<string, Stand | undefined>,
): Record<string, Stand> {
  const naechste: Record<string, Stand> = {};
  for (const [key, stand] of Object.entries(staende)) {
    if (stand) naechste[key] = stand;
  }

  for (const punkt of offenePunkte(punkte, staende)) {
    if (punkt.limitValue != null && !staende[punkt.key]?.measuredValue) continue;

    // Alles Eingetragene bleibt stehen – Meßwert, Bemerkung –, nur das
    // Ergebnis wechselt.
    naechste[punkt.key] = { ...staende[punkt.key], result: 'OK' } as Stand;
  }

  return naechste;
}
