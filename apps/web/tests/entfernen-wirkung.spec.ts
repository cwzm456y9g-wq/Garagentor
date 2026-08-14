import { angebotWirkung, auftragWirkung, rechnungWirkung } from '@/lib/entfernen-wirkung';

/**
 * Was der Knopf ankündigt, muß der Server auch tun.
 *
 * Die Regel steht zweimal – im Dienst, der sie ausführt, und in der Wirkung,
 * die sie ankündigt. Diese Prüfungen halten beide zusammen. Sie sind der
 * eigentliche Grund, warum die Wortwahl eine eigene Datei bekommen hat:
 * Ein Knopf, der „Löschen" heißt und storniert, ist mir in diesem Projekt
 * schon zweimal unterlaufen.
 */
describe('Wirkung beim Entfernen', () => {
  describe('Angebot', () => {
    it('löscht den Entwurf – und sagt das auch', () => {
      const wirkung = angebotWirkung('AN-2026-0001', 'ENTWURF', 0);

      expect(wirkung.moeglich).toBe(true);
      expect(wirkung.beschriftung).toBe('Löschen');
      expect(wirkung.beschreibung).toContain('vollständig entfernt');
    });

    it('storniert, was schon heraus ist, statt es zu löschen', () => {
      for (const status of ['VERSENDET', 'ANGENOMMEN', 'ABGELEHNT', 'ABGELAUFEN']) {
        const wirkung = angebotWirkung('AN-2026-0001', status, 0);

        expect(wirkung.beschriftung).toBe('Stornieren');
        expect(wirkung.beschreibung).toContain('bleibt erhalten');
        expect(wirkung.beschreibung).not.toContain('vollständig entfernt');
      }
    });

    it('lehnt ab, sobald ein Auftrag daran hängt – wie der Dienst', () => {
      // Der Dienst wirft dann 409, und zwar unabhängig vom Status.
      for (const status of ['ENTWURF', 'VERSENDET', 'ANGENOMMEN']) {
        const wirkung = angebotWirkung('AN-2026-0001', status, 1);

        expect(wirkung.moeglich).toBe(false);
        expect(wirkung.beschreibung).toContain('bereits ein Auftrag');
      }
    });

    it('wiederholt kein Storno', () => {
      expect(angebotWirkung('AN-2026-0001', 'STORNIERT', 0).moeglich).toBe(false);
    });
  });

  describe('Auftrag', () => {
    it('löscht nur den frisch angelegten', () => {
      const wirkung = auftragWirkung('AU-2026-0001', 'ANGELEGT', 0);

      expect(wirkung.moeglich).toBe(true);
      expect(wirkung.beschriftung).toBe('Löschen');
    });

    it('storniert alles, was schon begonnen hat', () => {
      for (const status of ['EINGEPLANT', 'IN_ARBEIT', 'WARTET_AUF_MATERIAL', 'ABGESCHLOSSEN']) {
        const wirkung = auftragWirkung('AU-2026-0001', status, 0);

        expect(wirkung.beschriftung).toBe('Stornieren');
        expect(wirkung.moeglich).toBe(true);
      }
    });

    it('lehnt ab, sobald Rechnungen daran hängen', () => {
      const wirkung = auftragWirkung('AU-2026-0001', 'ANGELEGT', 2);

      expect(wirkung.moeglich).toBe(false);
      expect(wirkung.beschreibung).toContain('Rechnungen');
    });
  });

  describe('Rechnung', () => {
    it('löscht den Entwurf, weil er nie ein Beleg war', () => {
      const wirkung = rechnungWirkung('RE-2026-0001', 'ENTWURF', 0);

      expect(wirkung.moeglich).toBe(true);
      expect(wirkung.beschriftung).toBe('Entwurf löschen');
      expect(wirkung.beschreibung).toContain('nie ein Beleg');
    });

    it('storniert die versendete und nennt den Grund dafür', () => {
      const wirkung = rechnungWirkung('RE-2026-0001', 'VERSENDET', 0);

      expect(wirkung.beschriftung).toBe('Stornieren');
      expect(wirkung.beschreibung).toContain('ordnungsmäßigen Buchführung');
      expect(wirkung.beschreibung).not.toContain('Gutschrift');
    });

    it('kündigt die Gutschrift an, wenn schon gezahlt wurde', () => {
      // Der Dienst erzeugt sie automatisch – wer das erst hinterher merkt,
      // sucht eine Rechnungsnummer, die er nicht vergeben hat.
      const wirkung = rechnungWirkung('RE-2026-0001', 'TEILWEISE_BEZAHLT', 456.25);

      expect(wirkung.beschreibung).toContain('Gutschrift');
      expect(wirkung.beschreibung).toContain('456,25');
    });

    it('erwähnt die abgebrochenen Mahnungen', () => {
      expect(rechnungWirkung('RE-2026-0001', 'UEBERFAELLIG', 0).beschreibung).toContain(
        'Mahnungen',
      );
    });

    it('wiederholt kein Storno', () => {
      const wirkung = rechnungWirkung('RE-2026-0001', 'STORNIERT', 100);

      expect(wirkung.moeglich).toBe(false);
      expect(wirkung.beschreibung).toContain('bereits storniert');
    });
  });

  describe('Durchgängig', () => {
    it('nennt in jedem Fall die Belegnummer', () => {
      const alle = [
        angebotWirkung('AN-1', 'ENTWURF', 0),
        angebotWirkung('AN-1', 'VERSENDET', 0),
        angebotWirkung('AN-1', 'ENTWURF', 1),
        auftragWirkung('AU-1', 'ANGELEGT', 0),
        auftragWirkung('AU-1', 'IN_ARBEIT', 0),
        auftragWirkung('AU-1', 'ANGELEGT', 1),
        rechnungWirkung('RE-1', 'ENTWURF', 0),
        rechnungWirkung('RE-1', 'VERSENDET', 0),
        rechnungWirkung('RE-1', 'STORNIERT', 0),
      ];

      for (const wirkung of alle) {
        expect(wirkung.beschreibung).toMatch(/AN-1|AU-1|RE-1/);
        expect(wirkung.beschriftung.length).toBeGreaterThan(0);
      }
    });

    it('verspricht nie ein Löschen, wo storniert wird', () => {
      const stornofaelle = [
        angebotWirkung('AN-1', 'VERSENDET', 0),
        auftragWirkung('AU-1', 'IN_ARBEIT', 0),
        rechnungWirkung('RE-1', 'VERSENDET', 0),
      ];

      for (const wirkung of stornofaelle) {
        expect(wirkung.beschriftung).toBe('Stornieren');
        expect(wirkung.knopf).toBe('Stornieren');
        expect(wirkung.beschreibung.toLowerCase()).toContain('bleibt erhalten');
      }
    });
  });
});
