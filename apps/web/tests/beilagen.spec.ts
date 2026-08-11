import { Role } from '@prisma/client';
import { sendMailSchema } from '@/server/dienste/mail/dto/mail.dto';
import { pruefeVersandrecht } from '@/server/dienste/mail/versandrechte';

/**
 * Beilagen: weitere Belege im selben Umschlag.
 *
 * Der Anlass ist der Alltag – zur Rechnung über eine Prüfung gehört das
 * Prüfprotokoll nach ASR A1.7. Die Prüfungen hier sichern die zwei Stellen,
 * an denen das schiefgehen könnte: die Eingabe und die Berechtigung.
 */
describe('Beilagen zum Belegversand', () => {
  const grund = {
    art: 'RECHNUNG' as const,
    id: 'r1',
    an: 'kunde@beispiel.de',
    betreff: 'Rechnung',
    text: 'Anbei.',
  };

  describe('Eingabeprüfung', () => {
    it('nimmt eine Rechnung mit beigelegtem Prüfprotokoll an', () => {
      const ergebnis = sendMailSchema.safeParse({
        ...grund,
        zusatz: [{ art: 'PRUEFPROTOKOLL', id: 'p1' }],
      });

      expect(ergebnis.success).toBe(true);
    });

    it('kommt ohne Beilagen aus', () => {
      expect(sendMailSchema.safeParse(grund).success).toBe(true);
    });

    it('lässt keine unbekannte Belegart zu', () => {
      const ergebnis = sendMailSchema.safeParse({
        ...grund,
        zusatz: [{ art: 'LIEFERSCHEIN', id: 'l1' }],
      });

      expect(ergebnis.success).toBe(false);
    });

    it('begrenzt die Zahl der Beilagen', () => {
      // Keine fachliche Grenze, sondern eine gegen Versehen: Kein Postfach
      // nimmt einen Umschlag mit dreißig PDF gern an.
      const zuviele = Array.from({ length: 11 }, (_, i) => ({
        art: 'PRUEFPROTOKOLL' as const,
        id: `p${i}`,
      }));

      expect(sendMailSchema.safeParse({ ...grund, zusatz: zuviele }).success).toBe(false);
      expect(sendMailSchema.safeParse({ ...grund, zusatz: zuviele.slice(0, 10) }).success).toBe(
        true,
      );
    });
  });

  describe('Berechtigung', () => {
    // Diese Prüfung ist der Grund, warum die Route jede Beilage einzeln
    // durchreicht. Ohne sie wäre der Umschlag ein Schlupfloch: Ein Monteur darf
    // den Servicebericht verschicken, die Rechnung nicht – er könnte sie sonst
    // einfach als Anhang mitgeben.
    it('lässt den Monteur den Servicebericht verschicken', () => {
      expect(() => pruefeVersandrecht('SERVICEBERICHT', Role.MONTEUR)).not.toThrow();
      expect(() => pruefeVersandrecht('PRUEFPROTOKOLL', Role.MONTEUR)).not.toThrow();
    });

    it('verwehrt ihm die Rechnung – auch als Beilage', () => {
      expect(() => pruefeVersandrecht('RECHNUNG', Role.MONTEUR)).toThrow();
      expect(() => pruefeVersandrecht('MAHNUNG', Role.MONTEUR)).toThrow();
    });

    it('lässt die Buchhaltung Rechnung und Protokoll zusammen verschicken', () => {
      for (const art of ['RECHNUNG', 'PRUEFPROTOKOLL'] as const) {
        expect(() => pruefeVersandrecht(art, Role.BUCHHALTUNG)).not.toThrow();
      }
    });
  });
});
