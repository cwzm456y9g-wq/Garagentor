import { MAIL_TEMPLATE_DEFAULTS } from '@garagentor/shared';
import { Role } from '@prisma/client';
import {
  bescheinigungsBefund,
  bescheinigungsSatz,
  gefahrImVerzug,
  sicherheitsrelevant,
} from '@/server/dienste/pdf/bescheinigung.werte';
import { sendMailSchema } from '@/server/dienste/mail/dto/mail.dto';
import { pruefeVersandrecht } from '@/server/dienste/mail/versandrechte';

/**
 * Die Prüfbescheinigung ist die Ausfertigung für den Kunden. Sie sagt, ob die
 * Anlage in Ordnung ist oder Mängel vorhanden sind – nicht mehr.
 *
 * Geprüft wird hier vor allem, dass die Aussage zum Ergebnis passt. Ein Blatt,
 * auf dem „Die Anlage ist in Ordnung" über einem nicht bestandenen Ergebnis
 * steht, wäre schlimmer als gar keine Bescheinigung.
 */
describe('Prüfbescheinigung', () => {
  describe('Befund zum Ergebnis', () => {
    it('nennt eine bestandene Anlage in Ordnung', () => {
      const befund = bescheinigungsBefund('BESTANDEN', []);

      expect(befund.ton).toBe('gut');
      expect(befund.ueberschrift).toContain('in Ordnung');
      expect(befund.anzahl).toBe(0);
      expect(befund.warnung).toBeNull();
    });

    it('nennt Hinweise, ohne sie zu Mängeln zu machen', () => {
      const befund = bescheinigungsBefund('BESTANDEN_MIT_HINWEISEN', []);

      expect(befund.ton).toBe('gut');
      expect(befund.ueberschrift).toContain('in Ordnung');
      expect(befund.satz).toContain('keine Mängel');
    });

    it('sagt bei geringen Mängeln, dass Mängel vorhanden sind', () => {
      const befund = bescheinigungsBefund('GERINGE_MAENGEL', [{ severity: 'GERING' }]);

      expect(befund.ton).toBe('hinweis');
      expect(befund.ueberschrift).toContain('Mängel vorhanden');
      expect(befund.satz).toContain('ein Mangel');
      expect(befund.satz).toContain('weiter betrieben');
    });

    it('zählt mehrere Mängel im Plural', () => {
      const befund = bescheinigungsBefund('GERINGE_MAENGEL', [
        { severity: 'GERING' },
        { severity: 'HINWEIS' },
        { severity: 'GERING' },
      ]);

      expect(befund.satz).toContain('3 Mängel');
      expect(befund.anzahl).toBe(3);
    });

    it('stuft erhebliche Mängel als ernst ein', () => {
      const befund = bescheinigungsBefund('ERHEBLICHE_MAENGEL', [{ severity: 'ERHEBLICH' }]);

      expect(befund.ton).toBe('ernst');
      expect(befund.satz).toContain('kurzfristig');
    });

    it('verlangt bei nicht bestandener Prüfung die Außerbetriebnahme', () => {
      const befund = bescheinigungsBefund('NICHT_BESTANDEN', [{ severity: 'ERHEBLICH' }]);

      expect(befund.ton).toBe('ernst');
      expect(befund.ueberschrift).toContain('nicht betriebssicher');
      expect(befund.satz).toContain('außer Betrieb');
    });

    it('behauptet ohne Ergebnis nichts', () => {
      const befund = bescheinigungsBefund(null, []);

      expect(befund.ueberschrift).toContain('noch nicht abgeschlossen');
      expect(befund.satz).not.toContain('in Ordnung');
    });
  });

  describe('Gefahr im Verzug', () => {
    it('wird auch bei sonst geringem Ergebnis ausgesprochen', () => {
      // Der Fall ist selten, aber möglich: ein einzelner Punkt wiegt schwerer,
      // als das Gesamtergebnis vermuten lässt. Verschwiegen werden darf er
      // nicht – der Betreiber haftet für den Weiterbetrieb.
      const befund = bescheinigungsBefund('GERINGE_MAENGEL', [
        { severity: 'GERING' },
        { severity: 'GEFAHR_IM_VERZUG' },
      ]);

      expect(befund.warnung).toContain('außer Betrieb');
    });

    it('erkennt die Schwere unabhängig von der Reihenfolge', () => {
      expect(gefahrImVerzug([{ severity: 'HINWEIS' }, { severity: 'GEFAHR_IM_VERZUG' }])).toBe(
        true,
      );
      expect(gefahrImVerzug([{ severity: 'GERING' }])).toBe(false);
      expect(sicherheitsrelevant([{ severity: 'ERHEBLICH' }])).toBe(true);
      expect(sicherheitsrelevant([{ severity: 'HINWEIS' }, { severity: 'GERING' }])).toBe(false);
    });
  });

  describe('Satz über der Unterschrift', () => {
    it('bleibt sachlich, solange nichts Ernstes vorliegt', () => {
      const satz = bescheinigungsSatz(bescheinigungsBefund('BESTANDEN', []));

      expect(satz).toContain('vorgeschriebenen Umfang');
      expect(satz).not.toContain('unterrichtet');
    });

    it('hält bei ernstem Befund die Unterrichtung des Betreibers fest', () => {
      const satz = bescheinigungsSatz(
        bescheinigungsBefund('NICHT_BESTANDEN', [{ severity: 'GEFAHR_IM_VERZUG' }]),
      );

      expect(satz).toContain('unterrichtet');
    });
  });

  describe('Versand', () => {
    it('ist als eigene Belegart versendbar', () => {
      const ergebnis = sendMailSchema.safeParse({
        art: 'PRUEFBESCHEINIGUNG',
        id: 'p1',
        an: 'kunde@beispiel.de',
        betreff: 'Prüfbescheinigung',
        text: 'Anbei.',
      });

      expect(ergebnis.success).toBe(true);
    });

    it('darf auch der Monteur verschicken', () => {
      expect(() => pruefeVersandrecht('PRUEFBESCHEINIGUNG', Role.MONTEUR)).not.toThrow();
    });

    it('kann als Beilage zur Rechnung mitgehen', () => {
      const ergebnis = sendMailSchema.safeParse({
        art: 'RECHNUNG',
        id: 'r1',
        an: 'kunde@beispiel.de',
        betreff: 'Rechnung',
        text: 'Anbei.',
        zusatz: [{ art: 'PRUEFBESCHEINIGUNG', id: 'p1' }],
      });

      expect(ergebnis.success).toBe(true);
    });

    it('weist im Anschreiben darauf hin, dass das Protokoll auf Wunsch kommt', () => {
      const vorlage = MAIL_TEMPLATE_DEFAULTS.PRUEFBESCHEINIGUNG;

      expect(vorlage.betreff).toContain('Prüfbescheinigung');
      expect(vorlage.text).toContain('auf Wunsch');
    });
  });
});
