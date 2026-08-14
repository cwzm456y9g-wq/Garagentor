import {
  absenderZeile,
  empfaengerListe,
  istEmpfaengerGueltig,
  mitSignatur,
  setzePlatzhalter,
  vorlageFuer,
} from '@/server/dienste/mail/vorlagen';

describe('Mailvorlagen', () => {
  describe('Platzhalter', () => {
    it('setzt bekannte Platzhalter ein', () => {
      expect(
        setzePlatzhalter('Rechnung {nummer} über {betrag}', {
          nummer: 'RE-2026-0001',
          betrag: '471,24 €',
        }),
      ).toBe('Rechnung RE-2026-0001 über 471,24 €');
    });

    it('lässt unbekannte Platzhalter stehen', () => {
      // Ein Tippfehler soll im Entwurf auffallen. Verschwände er stillschweigend,
      // ginge die Lücke ungeprüft an den Kunden.
      expect(setzePlatzhalter('Hallo {kundr}', { kunde: 'Weber' })).toBe('Hallo {kundr}');
    });

    it('leert einen bekannten Platzhalter ohne Wert', () => {
      expect(setzePlatzhalter('Anlage {anlage}.', { anlage: undefined })).toBe('Anlage .');
    });

    it('kommt mit Umlauten im Namen zurecht', () => {
      expect(setzePlatzhalter('{faellig}', { faellig: '15.08.2026' })).toBe('15.08.2026');
    });

    it('ersetzt jedes Vorkommen', () => {
      expect(setzePlatzhalter('{nummer} und nochmal {nummer}', { nummer: 'A' })).toBe(
        'A und nochmal A',
      );
    });
  });

  describe('Vorlagenauswahl', () => {
    it('nimmt die Vorgabe, wenn nichts gepflegt ist', () => {
      expect(vorlageFuer('RECHNUNG', null).betreff).toContain('{nummer}');
    });

    it('bevorzugt die eigene Vorlage', () => {
      const vorlage = vorlageFuer('RECHNUNG', { RECHNUNG: { betreff: 'Ihre Rechnung {nummer}' } });

      expect(vorlage.betreff).toBe('Ihre Rechnung {nummer}');
      // Der nicht überschriebene Teil kommt weiter aus der Vorgabe.
      expect(vorlage.text.length).toBeGreaterThan(0);
    });

    it('behandelt eine geleerte Vorlage als nicht gepflegt', () => {
      // Sonst ginge eine Mail ohne Betreff hinaus, nur weil jemand das Feld
      // leergeräumt hat.
      const vorlage = vorlageFuer('ANGEBOT', { ANGEBOT: { betreff: '   ', text: '' } });

      expect(vorlage.betreff.trim().length).toBeGreaterThan(0);
      expect(vorlage.text.trim().length).toBeGreaterThan(0);
    });
  });

  describe('Signatur', () => {
    it('hängt Gruß und Signatur an', () => {
      expect(mitSignatur('Text', 'Tortechnik Weber GmbH')).toBe(
        'Text\n\nMit freundlichen Grüßen\n\nTortechnik Weber GmbH',
      );
    });

    it('endet ohne Signatur trotzdem mit dem Gruß', () => {
      expect(mitSignatur('Text', null)).toBe('Text\n\nMit freundlichen Grüßen');
      expect(mitSignatur('Text', '   ')).toBe('Text\n\nMit freundlichen Grüßen');
    });
  });

  describe('Empfänger', () => {
    it('erkennt brauchbare Adressen', () => {
      expect(istEmpfaengerGueltig('info@tortechnik-weber.de')).toBe(true);
      expect(istEmpfaengerGueltig(' a.peters@rheinland-logistik.example ')).toBe(true);
    });

    it('weist offensichtlichen Unsinn ab', () => {
      expect(istEmpfaengerGueltig('kein-at-zeichen.de')).toBe(false);
      expect(istEmpfaengerGueltig('zwei@@at.de')).toBe(false);
      expect(istEmpfaengerGueltig('ohne@punkt')).toBe(false);
      expect(istEmpfaengerGueltig('')).toBe(false);
    });

    it('zerlegt Listen nach Komma und Semikolon', () => {
      expect(empfaengerListe('a@b.de, c@d.de; e@f.de')).toEqual(['a@b.de', 'c@d.de', 'e@f.de']);
      expect(empfaengerListe('  ')).toEqual([]);
      expect(empfaengerListe(null)).toEqual([]);
    });
  });

  describe('Absenderzeile', () => {
    it('schachtelt keine zweite Klammer, wenn MAIL_FROM schon einen Namen trägt', () => {
      // Der Fehler war im Postfach als Absender „Betrieb>" zu sehen.
      expect(absenderZeile('Zeller Tore', 'Zeller Tore <post@zeller-tore.de>')).toBe(
        '"Zeller Tore" <post@zeller-tore.de>',
      );
    });

    it('ergänzt den Namen um eine nackte Adresse', () => {
      expect(absenderZeile('Zeller Tore', 'post@zeller-tore.de')).toBe(
        '"Zeller Tore" <post@zeller-tore.de>',
      );
    });

    it('lässt MAIL_FROM unangetastet, wenn kein Name gepflegt ist', () => {
      expect(absenderZeile(null, 'Zeller Tore <post@zeller-tore.de>')).toBe(
        'Zeller Tore <post@zeller-tore.de>',
      );
      expect(absenderZeile('  ', 'post@zeller-tore.de')).toBe('post@zeller-tore.de');
    });

    it('entfernt Anführungszeichen aus dem Namen, die die Zeile zerlegen würden', () => {
      expect(absenderZeile('Zeller "Tore"', 'post@zeller-tore.de')).toBe(
        '"Zeller Tore" <post@zeller-tore.de>',
      );
    });

    it('gibt ohne MAIL_FROM nichts zurück', () => {
      expect(absenderZeile('Zeller Tore', null)).toBeUndefined();
      expect(absenderZeile('Zeller Tore', '   ')).toBeUndefined();
    });
  });
});
