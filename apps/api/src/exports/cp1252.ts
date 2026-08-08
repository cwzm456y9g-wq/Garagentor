/**
 * Umwandlung nach Windows-1252.
 *
 * Das DATEV-Format erwartet ANSI, nicht UTF-8; eine Datei in UTF-8 kommt in
 * der Kanzlei mit zerlegten Umlauten an. Node kennt die Kodierung nicht, und
 * für die Handvoll Zeichen, die über Latin-1 hinausgeht, lohnt keine
 * zusätzliche Abhängigkeit.
 */

/** Zeichen aus 0x80–0x9F, die Windows-1252 gegenüber Latin-1 zusätzlich kennt. */
const ZUSATZ: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  ƒ: 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  ˆ: 0x88,
  '‰': 0x89,
  Š: 0x8a,
  '‹': 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  š: 0x9a,
  '›': 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
};

/**
 * Ersatzschreibweisen für Zeichen, die es in Windows-1252 nicht gibt. Ein
 * Fragezeichen mitten im Buchungstext hilft niemandem.
 */
const ERSATZ: Record<string, string> = {
  '\u00a0': ' ', // geschütztes Leerzeichen
  '\u202f': ' ', // schmales geschütztes Leerzeichen
  '\u2009': ' ', // schmales Leerzeichen
  '\u2011': '-', // geschützter Bindestrich
  '\u2212': '-', // Minuszeichen
  '\u00ad': '', // bedingter Trennstrich
};

export function toWindows1252(text: string): Buffer {
  const bytes: number[] = [];

  for (const zeichen of text) {
    const ersetzt = ERSATZ[zeichen];
    if (ersetzt !== undefined) {
      for (const b of ersetzt) bytes.push(b.codePointAt(0)!);
      continue;
    }

    const zusatz = ZUSATZ[zeichen];
    if (zusatz !== undefined) {
      bytes.push(zusatz);
      continue;
    }

    const code = zeichen.codePointAt(0)!;
    // 0x00–0xFF deckt sich mit Latin-1; 0x80–0x9F sind dort Steuerzeichen und
    // oben bereits abgefangen.
    bytes.push(code <= 0xff ? code : 0x3f);
  }

  return Buffer.from(bytes);
}

/**
 * Ein Feld für die DATEV-CSV.
 *
 * Texte stehen in Anführungszeichen, Zahlen nicht – so verlangt es das Format.
 * Semikolon und Anführungszeichen im Text würden die Spalten verschieben und
 * werden deshalb entfernt bzw. verdoppelt; Zeilenumbrüche fallen weg.
 */
export function feld(wert: string | number | null | undefined): string {
  if (wert === null || wert === undefined || wert === '') return '';
  if (typeof wert === 'number') return String(wert);

  const bereinigt = wert.replace(/[\r\n]+/g, ' ').replace(/"/g, '""');
  return `"${bereinigt}"`;
}

/** Betrag im DATEV-Format: immer positiv, Komma als Trennzeichen. */
export function betrag(wert: number): string {
  return Math.abs(wert).toFixed(2).replace('.', ',');
}
