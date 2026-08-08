import { ergebnisText, istBeanstandet, messwertText } from './protokoll.werte';

describe('Prüfprotokoll', () => {
  describe('Messwerte', () => {
    it('stellt den Messwert mit Einheit und Grenzwert dar', () => {
      // Ohne den Grenzwert wäre im Nachhinein nicht mehr erkennbar, wogegen
      // gemessen wurde – die Grenzen der DIN EN 12453 sind je Punkt verschieden.
      expect(messwertText(320, 'N', 400)).toBe('320 N (max. 400)');
    });

    it('rundet auf zwei Nachkommastellen und schreibt deutsch', () => {
      expect(messwertText(1234.567, 'ms', 5000)).toBe('1.234,57 ms (max. 5.000)');
    });

    it('zeigt bei fehlender Messung nur den Grenzwert', () => {
      expect(messwertText(null, 'N', 400)).toBe('max. 400 N');
    });

    it('bleibt leer, wenn der Prüfpunkt gar nicht gemessen wird', () => {
      expect(messwertText(null, null, null)).toBe('');
    });

    it('kommt ohne Grenzwert aus', () => {
      expect(messwertText(12, 'mm', null)).toBe('12 mm');
    });

    it('behandelt den Messwert null als Messung, nicht als fehlend', () => {
      // 0 N ist ein gültiges Ergebnis und darf nicht als „nicht gemessen“ gelten.
      expect(messwertText(0, 'N', 400)).toBe('0 N (max. 400)');
    });
  });

  describe('Ergebnis', () => {
    it('übersetzt das Ergebnis in Klartext', () => {
      expect(ergebnisText('NICHT_BESTANDEN')).toBe('Nicht bestanden');
      expect(ergebnisText('BESTANDEN')).toBe('Bestanden');
    });

    it('kennzeichnet ein offenes Protokoll', () => {
      expect(ergebnisText(null)).toBe('in Bearbeitung');
    });

    it('hebt beanstandete Ergebnisse hervor', () => {
      expect(istBeanstandet('NICHT_BESTANDEN')).toBe(true);
      expect(istBeanstandet('ERHEBLICHE_MAENGEL')).toBe(true);
      expect(istBeanstandet('GERINGE_MAENGEL')).toBe(true);
      expect(istBeanstandet('BESTANDEN')).toBe(false);
      expect(istBeanstandet('BESTANDEN_MIT_HINWEISEN')).toBe(false);
      expect(istBeanstandet(null)).toBe(false);
    });
  });
});
