import { calculateInterest, calculateDocumentTotals, round } from '@garagentor/shared';
import { LineItemType } from '@prisma/client';
import { prepareLineItems, withoutOptionalFlag, type LineItemDto } from './line-item.dto';

function item(overrides: Partial<LineItemDto>): LineItemDto {
  return {
    type: LineItemType.LEISTUNG,
    title: 'Position',
    quantity: 1,
    unit: 'Stk',
    unitPrice: 0,
    discountPercent: 0,
    vatRate: 19,
    ...overrides,
  } as LineItemDto;
}

describe('Belegrechnung', () => {
  describe('round', () => {
    it('rundet kaufmännisch auch bei Binärdarstellungsfehlern', () => {
      // 1.005 * 100 ergibt in Gleitkomma 100.49999999999999.
      expect(round(1.005)).toBe(1.01);
      expect(round(2.675)).toBe(2.68);
      expect(round(-1.005)).toBe(-1.01);
      expect(round(0.1 + 0.2)).toBe(0.3);
    });
  });

  describe('prepareLineItems', () => {
    it('nummeriert Positionen fortlaufend ab 1', () => {
      const { prepared } = prepareLineItems([
        item({ title: 'A' }),
        item({ title: 'B' }),
        item({ title: 'C' }),
      ]);

      expect(prepared.map((entry) => entry.position)).toEqual([1, 2, 3]);
    });

    it('berechnet Netto, Steuer und Brutto einer Position', () => {
      const { totals } = prepareLineItems([item({ quantity: 2.5, unitPrice: 79 })]);

      expect(totals.netAmount).toBe(197.5);
      expect(totals.vatAmount).toBe(37.53);
      expect(totals.grossAmount).toBe(235.03);
    });

    it('berücksichtigt den Positionsrabatt', () => {
      const { totals } = prepareLineItems([
        item({ quantity: 1, unitPrice: 1000, discountPercent: 10 }),
      ]);

      expect(totals.netAmount).toBe(900);
      expect(totals.vatAmount).toBe(171);
    });

    it('lässt Text- und Zwischensummenpositionen außen vor', () => {
      const { totals } = prepareLineItems([
        item({ unitPrice: 100 }),
        item({ type: LineItemType.TEXT, unitPrice: 999, quantity: 5 }),
        item({ type: LineItemType.ZWISCHENSUMME, unitPrice: 999 }),
      ]);

      expect(totals.netAmount).toBe(100);
    });

    it('schließt optionale Angebotspositionen aus der Summe aus', () => {
      const { prepared, totals } = prepareLineItems([
        item({ unitPrice: 1000 }),
        item({ unitPrice: 500, optional: true }),
      ]);

      expect(totals.netAmount).toBe(1000);
      // Die optionale Position bleibt im Beleg erhalten.
      expect(prepared).toHaveLength(2);
      expect(prepared[1].optional).toBe(true);
    });

    it('verteilt den Gesamtrabatt anteilig auf die Steuersätze', () => {
      const { totals } = prepareLineItems(
        [item({ unitPrice: 1000, vatRate: 19 }), item({ unitPrice: 1000, vatRate: 7 })],
        10,
      );

      expect(totals.subtotal).toBe(2000);
      expect(totals.discountAmount).toBe(200);
      expect(totals.netAmount).toBe(1800);
      expect(totals.vatBreakdown).toEqual([
        { rate: 7, net: 900, vat: 63 },
        { rate: 19, net: 900, vat: 171 },
      ]);
      expect(totals.vatAmount).toBe(234);
      expect(totals.grossAmount).toBe(2034);
    });

    it('führt gleiche Steuersätze in der Aufteilung zusammen', () => {
      const { vatBreakdown } = calculateDocumentTotals([
        { quantity: 1, unitPrice: 100, vatRate: 19 },
        { quantity: 1, unitPrice: 200, vatRate: 19 },
      ]);

      expect(vatBreakdown).toEqual([{ rate: 19, net: 300, vat: 57 }]);
    });
  });

  describe('withoutOptionalFlag', () => {
    it('entfernt das Feld für Belegarten ohne optionale Positionen', () => {
      const { prepared } = prepareLineItems([item({ unitPrice: 10, optional: true })]);

      expect(withoutOptionalFlag(prepared[0])).not.toHaveProperty('optional');
      // Das Original bleibt unverändert.
      expect(prepared[0].optional).toBe(true);
    });
  });

  describe('calculateInterest', () => {
    it('berechnet Verzugszinsen taggenau', () => {
      // 1.000 € zu 9 % über 30 Tage.
      expect(calculateInterest(1000, 9, 30)).toBe(7.4);
    });

    it('liefert null ohne Verzug oder Zinssatz', () => {
      expect(calculateInterest(1000, 9, 0)).toBe(0);
      expect(calculateInterest(1000, 0, 30)).toBe(0);
      expect(calculateInterest(0, 9, 30)).toBe(0);
    });
  });
});
