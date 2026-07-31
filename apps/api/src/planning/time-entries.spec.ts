import { daysBetween, durationHours, endOfMonth, isoWeek, startOfMonth } from '@garagentor/shared';

describe('Zeitberechnung', () => {
  describe('durationHours', () => {
    it('zieht die Pause von der Anwesenheit ab', () => {
      expect(durationHours('2026-08-03T07:00:00Z', '2026-08-03T12:00:00Z', 30)).toBe(4.5);
      expect(durationHours('2026-08-03T07:00:00Z', '2026-08-03T12:00:00Z', 0)).toBe(5);
    });

    it('rechnet über Mitternacht hinweg', () => {
      expect(durationHours('2026-08-03T22:00:00Z', '2026-08-04T02:30:00Z')).toBe(4.5);
    });

    it('liefert null, wenn die Pause den Zeitraum übersteigt', () => {
      expect(durationHours('2026-08-03T08:00:00Z', '2026-08-03T09:00:00Z', 90)).toBe(0);
    });

    it('rundet auf zwei Nachkommastellen', () => {
      // 20 Minuten sind 0,3333… Stunden.
      expect(durationHours('2026-08-03T08:00:00Z', '2026-08-03T08:20:00Z')).toBe(0.33);
    });
  });

  describe('daysBetween', () => {
    it('zählt volle Tage unabhängig von der Uhrzeit', () => {
      expect(daysBetween('2026-08-03T23:00:00', '2026-08-04T01:00:00')).toBe(1);
      expect(daysBetween('2026-08-04', '2026-08-03')).toBe(-1);
      expect(daysBetween('2026-08-03', '2026-08-03')).toBe(0);
    });

    it('rechnet über Monats- und Jahresgrenzen', () => {
      expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
      expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    });
  });

  describe('Monatsgrenzen', () => {
    it('bestimmt Anfang und Ende eines Monats', () => {
      const start = startOfMonth(new Date(2026, 1, 17));
      const end = endOfMonth(new Date(2026, 1, 17));

      expect(start.getDate()).toBe(1);
      expect(start.getHours()).toBe(0);
      // 2026 ist kein Schaltjahr.
      expect(end.getDate()).toBe(28);
      expect(end.getMonth()).toBe(1);
    });

    it('berücksichtigt Schaltjahre', () => {
      expect(endOfMonth(new Date(2028, 1, 5)).getDate()).toBe(29);
    });
  });

  describe('isoWeek', () => {
    it('folgt der Zählweise nach ISO 8601', () => {
      // Der 4. Januar liegt stets in Kalenderwoche 1.
      expect(isoWeek(new Date(2026, 0, 4))).toBe(1);
      expect(isoWeek(new Date(2026, 0, 5))).toBe(2);
    });
  });
});
