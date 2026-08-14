/**
 * Werte für die Sicherung aufbereiten.
 *
 * Zwei Leser, zwei Ansprüche – deshalb entsteht jede Tabelle zweimal:
 *
 * Die CSV ist für Menschen und für Excel. Sie schreibt deutsche Zahlen und
 * Daten, weil sie in einem deutschen Excel geöffnet wird; ein Betrag als
 * „1234.50" bliebe dort Text und ließe sich nicht summieren.
 *
 * Die JSON ist für Maschinen. Sie hält die Werte so, wie sie in der Datenbank
 * stehen: Zahlen als Zahlen, Zeitpunkte nach ISO 8601. Aus ihr ließe sich der
 * Bestand wieder einspielen, aus der CSV nur mit Verlusten.
 */

const ZAHL = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
  useGrouping: false,
});

const DATUM = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Prisma liefert Beträge als Decimal-Objekt, nicht als Zahl. */
function istDecimal(wert: unknown): wert is { toNumber(): number } {
  return typeof wert === 'object' && wert !== null && 'toNumber' in wert;
}

/** Der Wert, wie er in die JSON gehört: unverfälscht und maschinenlesbar. */
export function fuerJson(wert: unknown): unknown {
  if (wert === null || wert === undefined) return null;
  if (wert instanceof Date) return wert.toISOString();
  if (Buffer.isBuffer(wert)) return wert.toString('base64');
  if (istDecimal(wert)) return wert.toNumber();
  if (typeof wert === 'bigint') return Number(wert);
  return wert;
}

/** Der Wert, wie ihn ein deutsches Excel erwartet. */
export function fuerCsv(wert: unknown): string {
  if (wert === null || wert === undefined) return '';
  if (wert instanceof Date) return DATUM.format(wert);
  if (istDecimal(wert)) return ZAHL.format(wert.toNumber());
  if (typeof wert === 'number') return ZAHL.format(wert);
  if (typeof wert === 'bigint') return ZAHL.format(Number(wert));
  if (typeof wert === 'boolean') return wert ? 'ja' : 'nein';
  if (Buffer.isBuffer(wert)) return `[${wert.byteLength} Byte]`;
  if (typeof wert === 'object') return JSON.stringify(wert);
  return String(wert);
}

/**
 * Ein Feld für die CSV.
 *
 * Anführungszeichen immer, nicht nur bei Bedarf: Das erspart die Frage, ob im
 * Text ein Semikolon oder ein Zeilenumbruch steckt. Enthaltene
 * Anführungszeichen werden verdoppelt, wie es RFC 4180 vorsieht.
 */
export function csvFeld(wert: unknown): string {
  return `"${fuerCsv(wert).replace(/"/g, '""')}"`;
}

/**
 * Byte-Reihenfolge-Marke: ohne sie hält Excel die Datei für Latin-1, und aus
 * „Straße" wird „StraÃŸe". Bewußt als Fluchtfolge geschrieben – als Zeichen
 * wäre sie im Quelltext unsichtbar.
 */
const BOM = '\uFEFF';

/** Eine vollständige CSV-Datei aus Spaltennamen und Zeilen. */
export function csvDatei(spalten: string[], zeilen: Array<Record<string, unknown>>): string {
  const kopf = spalten.map((spalte) => csvFeld(spalte)).join(';');
  const inhalt = zeilen.map((zeile) => spalten.map((spalte) => csvFeld(zeile[spalte])).join(';'));

  // CRLF, damit auch ältere Windows-Programme die Zeilen erkennen.
  return `${BOM}${[kopf, ...inhalt].join('\r\n')}\r\n`;
}
