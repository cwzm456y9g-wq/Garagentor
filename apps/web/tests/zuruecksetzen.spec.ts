import {
  BESTAETIGUNG,
  bestandsRueckstellung,
  GELOESCHTE_ARTEN,
  NUMMERNKREISE,
} from '@/server/dienste/settings/zuruecksetzen.regeln';

/**
 * Die Regeln des Zurücksetzens.
 *
 * Ein Vorgang, den man einmal im Leben einer Installation ausführt und der
 * sich nicht zurücknehmen läßt. Was sich daran prüfen läßt, gehört geprüft.
 */
describe('Betriebsdaten zurücksetzen', () => {
  describe('Lagerbestand zurückbuchen', () => {
    it('gibt einen Abgang an den Bestand zurück', () => {
      // Ein Servicebericht hat drei Federn ausgebaut und aus dem Lager
      // gebucht. Verschwindet der Bericht, liegen die Federn wieder da.
      const { deltas } = bestandsRueckstellung([
        { articleId: 'a1', type: 'ABGANG', quantity: 3 },
      ]);

      expect(deltas.get('a1')).toBe(3);
    });

    it('nimmt einen Zugang wieder weg', () => {
      const { deltas } = bestandsRueckstellung([
        { articleId: 'a1', type: 'ZUGANG', quantity: 5 },
      ]);

      expect(deltas.get('a1')).toBe(-5);
    });

    it('behandelt eine Retoure wie einen Zugang', () => {
      const { deltas } = bestandsRueckstellung([
        { articleId: 'a1', type: 'RETOURE', quantity: 2 },
      ]);

      expect(deltas.get('a1')).toBe(-2);
    });

    it('faßt mehrere Buchungen desselben Artikels zusammen', () => {
      const { deltas } = bestandsRueckstellung([
        { articleId: 'a1', type: 'ABGANG', quantity: 4 },
        { articleId: 'a1', type: 'ABGANG', quantity: 1 },
        { articleId: 'a2', type: 'ABGANG', quantity: 7 },
      ]);

      expect(deltas.get('a1')).toBe(5);
      expect(deltas.get('a2')).toBe(7);
    });

    it('läßt einen Artikel weg, dessen Buchungen sich aufheben', () => {
      // Sonst stünde eine Schreiboperation in der Transaktion, die nichts tut.
      const { deltas } = bestandsRueckstellung([
        { articleId: 'a1', type: 'ABGANG', quantity: 2 },
        { articleId: 'a1', type: 'ZUGANG', quantity: 2 },
      ]);

      expect(deltas.has('a1')).toBe(false);
    });

    it('rechnet Inventur und Korrektur nicht zurück, sondern meldet sie', () => {
      // Eine Inventur setzt einen absoluten Bestand. Was vorher stand, geht
      // aus der Buchung nicht hervor – eine Umkehrung wäre geraten.
      const { deltas, ungerechnet } = bestandsRueckstellung([
        { articleId: 'a1', type: 'INVENTUR', quantity: 12 },
        { articleId: 'a2', type: 'KORREKTUR', quantity: 3 },
        { articleId: 'a3', type: 'UMLAGERUNG', quantity: 1 },
      ]);

      expect(deltas.size).toBe(0);
      expect(ungerechnet).toBe(3);
    });

    it('rundet auf drei Stellen, wie das Lager die Mengen führt', () => {
      const { deltas } = bestandsRueckstellung([
        { articleId: 'a1', type: 'ABGANG', quantity: 0.1 },
        { articleId: 'a1', type: 'ABGANG', quantity: 0.2 },
      ]);

      expect(deltas.get('a1')).toBe(0.3);
    });

    it('kommt mit gar keiner Buchung zurecht', () => {
      const { deltas, ungerechnet } = bestandsRueckstellung([]);

      expect(deltas.size).toBe(0);
      expect(ungerechnet).toBe(0);
    });
  });

  describe('Nummernkreise', () => {
    it('setzt nur die Belegarten zurück, deren Belege verschwinden', () => {
      expect([...NUMMERNKREISE]).toEqual(
        expect.arrayContaining(['CUSTOMER', 'QUOTE', 'ORDER', 'INVOICE', 'INSPECTION']),
      );
    });

    it('läßt Lieferanten, Artikel, Mitarbeiter und Bestellungen in Ruhe', () => {
      // Deren Datensätze bleiben. Eine zweite LI-0001 neben einer bestehenden
      // wäre ein Fehler, den man erst Monate später bemerkt.
      for (const entitaet of ['SUPPLIER', 'ARTICLE', 'EMPLOYEE', 'PURCHASE_ORDER']) {
        expect([...NUMMERNKREISE]).not.toContain(entitaet);
      }
    });
  });

  describe('Akten und Mailprotokolle', () => {
    it('nennt die Entitätsarten, deren Anhänge mitgehen', () => {
      expect([...GELOESCHTE_ARTEN]).toEqual(
        expect.arrayContaining(['CUSTOMER', 'INVOICE', 'DOOR', 'INSPECTION', 'SERVICE_REPORT']),
      );
    });

    it('nennt Projekte nicht – dort entscheidet die Kennung', () => {
      // Projekte ohne Kundenbezug bleiben stehen, also darf die Art allein
      // nicht ausreichen, um ihre Anhänge zu löschen.
      expect([...GELOESCHTE_ARTEN]).not.toContain('PROJECT');
    });

    it('läßt die Stammdaten des Betriebs unberührt', () => {
      for (const art of ['ARTICLE', 'SUPPLIER', 'EMPLOYEE', 'PURCHASE_ORDER']) {
        expect([...GELOESCHTE_ARTEN]).not.toContain(art);
      }
    });
  });

  describe('Bestätigungswort', () => {
    it('kommt ohne Umlaut aus', () => {
      // Es muß abgetippt werden; ein Umlaut auf einer fremden Tastatur wäre
      // eine Hürde ohne Nutzen.
      expect(BESTAETIGUNG).toMatch(/^[A-Z]+$/);
    });
  });
});
