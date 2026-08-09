import { abgleichMitSkonto, skontoAmount, withinSkontoPeriod } from '@garagentor/shared';

/**
 * Der Zahlungsabgleich mit Skonto entscheidet, ob eine Rechnung als bezahlt
 * gilt oder in den Mahnlauf läuft. Die Toleranz ist dabei der heikle Teil: zu
 * eng, und jeder rundende Kunde erzeugt Handarbeit; zu weit, und eine echte
 * Unterzahlung verschwindet.
 */
describe('Skonto', () => {
  describe('Betrag', () => {
    it('rechnet den Abzug kaufmännisch', () => {
      expect(skontoAmount(456.25, 2)).toBe(9.13);
      expect(skontoAmount(1000, 3)).toBe(30);
    });

    it('gibt ohne Satz oder Betrag null zurück', () => {
      expect(skontoAmount(456.25, 0)).toBe(0);
      expect(skontoAmount(0, 2)).toBe(0);
      expect(skontoAmount(-100, 2)).toBe(0);
    });
  });

  describe('Frist', () => {
    const rechnung = '2026-06-17';

    it('lässt den letzten Tag noch gelten', () => {
      // Eine Gutschrift am zehnten Tag um 23 Uhr ist rechtzeitig.
      expect(withinSkontoPeriod('2026-06-27T23:00:00', rechnung, 10)).toBe(true);
    });

    it('weist den Tag danach ab', () => {
      expect(withinSkontoPeriod('2026-06-28T08:00:00', rechnung, 10)).toBe(false);
    });

    it('kennt ohne Frist keinen Skonto', () => {
      expect(withinSkontoPeriod('2026-06-18', rechnung, 0)).toBe(false);
    });
  });

  describe('Abgleich', () => {
    const skonto = skontoAmount(456.25, 2); // 9,13 €

    it('bucht die volle Zahlung als Ausgleich', () => {
      const ergebnis = abgleichMitSkonto({
        offen: 456.25,
        zahlung: 456.25,
        skonto: 0,
        toleranz: 0.05,
      });

      expect(ergebnis).toEqual({ ausgeglichen: true, skonto: 0, rest: 0 });
    });

    it('erkennt den gezogenen Skonto', () => {
      const ergebnis = abgleichMitSkonto({
        offen: 456.25,
        zahlung: 447.12,
        skonto,
        toleranz: 0.05,
      });

      expect(ergebnis.ausgeglichen).toBe(true);
      expect(ergebnis.skonto).toBe(9.13);
      expect(ergebnis.rest).toBe(0);
    });

    it('verzeiht Rundung des Kunden innerhalb der Toleranz', () => {
      // 447,10 statt 447,12 – zwei Cent, die niemand nachbuchen will.
      const ergebnis = abgleichMitSkonto({
        offen: 456.25,
        zahlung: 447.1,
        skonto,
        toleranz: 0.05,
      });

      expect(ergebnis.ausgeglichen).toBe(true);
      expect(ergebnis.skonto).toBe(9.15);
    });

    it('lässt eine echte Unterzahlung offen', () => {
      // Vierzig Euro zu wenig sind kein Rundungsfehler.
      const ergebnis = abgleichMitSkonto({
        offen: 456.25,
        zahlung: 416.25,
        skonto,
        toleranz: 0.05,
      });

      expect(ergebnis.ausgeglichen).toBe(false);
      expect(ergebnis.skonto).toBe(0);
      expect(ergebnis.rest).toBe(40);
    });

    it('zieht die Toleranz nicht als pauschalen Nachlass heran', () => {
      // Genau einen Euro zu wenig, ohne Skontoanspruch: bleibt offen.
      const ergebnis = abgleichMitSkonto({
        offen: 456.25,
        zahlung: 455.25,
        skonto: 0,
        toleranz: 0.05,
      });

      expect(ergebnis.ausgeglichen).toBe(false);
      expect(ergebnis.rest).toBe(1);
    });

    it('gleicht auch ohne Skonto bei Centabweichung aus', () => {
      const ergebnis = abgleichMitSkonto({
        offen: 456.25,
        zahlung: 456.22,
        skonto: 0,
        toleranz: 0.05,
      });

      expect(ergebnis.ausgeglichen).toBe(true);
      expect(ergebnis.rest).toBe(0.03);
    });

    it('behandelt eine Teilzahlung als Teilzahlung', () => {
      const ergebnis = abgleichMitSkonto({
        offen: 456.25,
        zahlung: 200,
        skonto,
        toleranz: 0.05,
      });

      expect(ergebnis.ausgeglichen).toBe(false);
      expect(ergebnis.rest).toBe(256.25);
    });

    it('greift ohne Skontoanspruch nicht auf den Skontobetrag zurück', () => {
      // Zu spät gezahlt: der Aufrufer übergibt dann skonto = 0, und der um den
      // Abzug verminderte Betrag bleibt eine Unterzahlung.
      const ergebnis = abgleichMitSkonto({
        offen: 456.25,
        zahlung: 447.12,
        skonto: 0,
        toleranz: 0.05,
      });

      expect(ergebnis.ausgeglichen).toBe(false);
      expect(ergebnis.rest).toBe(9.13);
    });
  });
});
