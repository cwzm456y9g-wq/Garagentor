import { betrag, feld, toWindows1252 } from './cp1252';

describe('DATEV-Kodierung', () => {
  describe('Windows-1252', () => {
    it('schreibt Umlaute als ein Byte', () => {
      // In UTF-8 wären es zwei; in der Kanzlei käme „SchlieÃŸkraft“ an.
      const bytes = toWindows1252('Schließkraft');

      expect(bytes.length).toBe('Schließkraft'.length);
      expect(bytes[6]).toBe(0xdf);
    });

    it('kennt die Zeichen, die über Latin-1 hinausgehen', () => {
      expect([...toWindows1252('€')]).toEqual([0x80]);
      expect([...toWindows1252('–')]).toEqual([0x96]);
      expect([...toWindows1252('„Text“')]).toEqual([0x84, 0x54, 0x65, 0x78, 0x74, 0x93]);
    });

    it('ersetzt schmale Leerzeichen durch gewöhnliche', () => {
      expect([...toWindows1252('1 000')]).toEqual([0x31, 0x20, 0x30, 0x30, 0x30]);
    });

    it('setzt ein Fragezeichen, wo die Kodierung nicht reicht', () => {
      expect([...toWindows1252('☺')]).toEqual([0x3f]);
    });
  });

  describe('Felder', () => {
    it('setzt Text in Anführungszeichen, Zahlen nicht', () => {
      expect(feld('Wartung')).toBe('"Wartung"');
      expect(feld(8400)).toBe('8400');
    });

    it('lässt leere Felder leer', () => {
      expect(feld(null)).toBe('');
      expect(feld(undefined)).toBe('');
      expect(feld('')).toBe('');
    });

    it('verdoppelt Anführungszeichen und entfernt Zeilenumbrüche', () => {
      // Beides würde sonst die Spalten verschieben.
      expect(feld('Tor "Nord"')).toBe('"Tor ""Nord"""');
      expect(feld('Zeile 1\nZeile 2')).toBe('"Zeile 1 Zeile 2"');
    });
  });

  describe('Beträge', () => {
    it('schreibt zwei Nachkommastellen mit Komma', () => {
      expect(betrag(471.24)).toBe('471,24');
      expect(betrag(1000)).toBe('1000,00');
    });

    it('gibt den Betrag immer positiv aus', () => {
      // Die Richtung steckt im Soll/Haben-Kennzeichen, nicht im Vorzeichen.
      expect(betrag(-471.24)).toBe('471,24');
    });
  });
});
