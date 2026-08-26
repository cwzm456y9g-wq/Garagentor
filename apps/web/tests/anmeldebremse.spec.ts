import { Anmeldebremse, GRENZEN, type Grenzen } from '@/server/anmeldebremse';

/**
 * Die Bremse vor der Anmeldung.
 *
 * Bis dahin konnte jemand unbegrenzt Passwörter durchprobieren. Was hier
 * geprüft wird, ist nicht nur, daß gebremst wird – sondern auch, daß die
 * Bremse niemanden aussperrt, der sich bloß vertippt hat, und daß sie nicht
 * verrät, welche Konten es gibt.
 */

/** Eine Minute in Millisekunden – die Tests rechnen mit einer eigenen Uhr. */
const MIN = 60_000;

const eng: Grenzen = {
  ...GRENZEN,
  versucheBisSperre: 3,
  grundsperreMs: 60_000,
  hoechstsperreMs: 8 * 60_000,
  herkunftVersuche: 5,
  herkunftFensterMs: 10 * 60_000,
  beobachtungsfensterMs: 10 * 60_000,
};

const konto = { email: 'chef@zeller-tore.de', ip: '203.0.113.7' };

describe('Anmeldebremse', () => {
  describe('Je Konto', () => {
    it('läßt die ersten Versuche durch', () => {
      const bremse = new Anmeldebremse(eng);
      let t = 0;

      for (let i = 0; i < 2; i++) {
        expect(bremse.pruefen(konto, t).erlaubt).toBe(true);
        expect(bremse.fehlversuch(konto, t).gesperrt).toBe(false);
        t += 1000;
      }
    });

    it('sperrt beim festgelegten Fehlversuch', () => {
      const bremse = new Anmeldebremse(eng);
      bremse.fehlversuch(konto, 0);
      bremse.fehlversuch(konto, 1000);

      const dritter = bremse.fehlversuch(konto, 2000);

      expect(dritter.gesperrt).toBe(true);
      expect(dritter.wartenSek).toBe(60);
    });

    it('weist während der Sperre ab, ohne das Passwort zu prüfen', () => {
      // Der eigentliche Zweck: Die Absage kommt vor Argon2id, sonst zahlte der
      // Server die 64 MB auch für Anfragen, die er ohnehin ablehnt.
      const bremse = new Anmeldebremse(eng);
      for (let i = 0; i < 3; i++) bremse.fehlversuch(konto, i * 1000);

      const befund = bremse.pruefen(konto, 3000);

      expect(befund.erlaubt).toBe(false);
      expect(befund.grund).toBe('konto');
      expect(befund.wartenSek).toBeGreaterThan(0);
    });

    it('läßt nach Ablauf der Sperre wieder zu', () => {
      const bremse = new Anmeldebremse(eng);
      for (let i = 0; i < 3; i++) bremse.fehlversuch(konto, i * 1000);

      // Die Sperre läuft ab dem letzten Fehlversuch bei 2000 ms, endet also
      // bei 62.000 ms.
      expect(bremse.pruefen(konto, 61_000).erlaubt).toBe(false);
      expect(bremse.pruefen(konto, 63_000).erlaubt).toBe(true);
    });

    it('verdoppelt die Sperre mit jedem weiteren Versuch', () => {
      const bremse = new Anmeldebremse(eng);
      for (let i = 0; i < 3; i++) bremse.fehlversuch(konto, i * 1000);

      expect(bremse.fehlversuch(konto, 61_000).wartenSek).toBe(120);
      expect(bremse.fehlversuch(konto, 200_000).wartenSek).toBe(240);
    });

    it('deckelt die Sperre bei der Obergrenze', () => {
      // Sonst wüchse sie ins Absurde und sperrte am Ende auf Jahre.
      const bremse = new Anmeldebremse(eng);
      // Dicht aufeinander, sonst begänne jedesmal ein neues Zählfenster.
      // Ab dem dritten Fehlversuch verdoppelt sich die Sperre: 60, 120, 240,
      // 480 – und beim siebten wären es 960, gedeckelt auf 480.
      const dauern = [];
      for (let i = 0; i < 7; i++) dauern.push(bremse.fehlversuch(konto, i * 1000).wartenSek);

      expect(dauern).toEqual([0, 0, 60, 120, 240, 480, 480]);
    });

    it('räumt das Konto nach geglückter Anmeldung ab', () => {
      // Wer sich zweimal vertippt und beim dritten Mal hineinkommt, startet
      // wieder bei null – sonst sperrte ihn der nächste Fehlgriff am Folgetag.
      const bremse = new Anmeldebremse(eng);
      bremse.fehlversuch(konto, 0);
      bremse.fehlversuch(konto, 1000);
      bremse.erfolg(konto);

      expect(bremse.fehlversuch(konto, 2000).gesperrt).toBe(false);
      expect(bremse.fehlversuch(konto, 3000).gesperrt).toBe(false);
    });

    it('vergißt alte Fehlversuche nach dem Beobachtungsfenster', () => {
      const bremse = new Anmeldebremse(eng);
      bremse.fehlversuch(konto, 0);
      bremse.fehlversuch(konto, 1000);

      // Zwei Fehlgriffe von vorletzter Woche dürfen den heutigen Versuch nicht
      // in die Sperre treiben.
      expect(bremse.fehlversuch(konto, 11 * MIN).gesperrt).toBe(false);
    });

    it('hält die Konten auseinander', () => {
      const bremse = new Anmeldebremse(eng);
      const anderer = { email: 'buero@zeller-tore.de', ip: '198.51.100.4' };
      for (let i = 0; i < 3; i++) bremse.fehlversuch(konto, i * 1000);

      expect(bremse.pruefen(konto, 3000).erlaubt).toBe(false);
      expect(bremse.pruefen(anderer, 3000).erlaubt).toBe(true);
    });

    it('zählt Groß- und Kleinschreibung als dieselbe Adresse', () => {
      // Sonst umginge man die Sperre durch ein großes A.
      const bremse = new Anmeldebremse(eng);
      bremse.fehlversuch({ email: 'Chef@Zeller-Tore.de' }, 0);
      bremse.fehlversuch({ email: 'chef@zeller-tore.de' }, 1000);
      bremse.fehlversuch({ email: '  CHEF@ZELLER-TORE.DE  ' }, 2000);

      expect(bremse.pruefen(konto, 2500).erlaubt).toBe(false);
    });

    it('sperrt auch eine Adresse, zu der es kein Konto gibt', () => {
      // Das ist der Punkt: Sperrte nur ein bestehendes Konto, verriete das
      // Verhalten, welche Adressen existieren – genau die Auskunft, die der
      // Blindhash bei der Passwortprüfung verhindert.
      const bremse = new Anmeldebremse(eng);
      const erfunden = { email: 'gibtesnicht@zeller-tore.de', ip: '203.0.113.9' };
      for (let i = 0; i < 3; i++) bremse.fehlversuch(erfunden, i * 1000);

      expect(bremse.pruefen(erfunden, 3000).erlaubt).toBe(false);
    });
  });

  describe('Je Herkunft', () => {
    it('bremst, wer viele Adressen durchprobiert', () => {
      // Die Kontobremse greift hier nie: Jede Adresse wird nur einmal
      // versucht. Deshalb braucht es die zweite Bremse.
      const bremse = new Anmeldebremse(eng);
      for (let i = 0; i < 5; i++) {
        bremse.fehlversuch({ email: `opfer${i}@zeller-tore.de`, ip: '203.0.113.7' }, i * 1000);
      }

      const befund = bremse.pruefen({ email: 'opfer99@zeller-tore.de', ip: '203.0.113.7' }, 6000);

      expect(befund.erlaubt).toBe(false);
      expect(befund.grund).toBe('herkunft');
    });

    it('läßt eine andere Herkunft in Ruhe', () => {
      const bremse = new Anmeldebremse(eng);
      for (let i = 0; i < 5; i++) {
        bremse.fehlversuch({ email: `opfer${i}@zeller-tore.de`, ip: '203.0.113.7' }, i * 1000);
      }

      expect(
        bremse.pruefen({ email: 'chef@zeller-tore.de', ip: '198.51.100.4' }, 6000).erlaubt,
      ).toBe(true);
    });

    it('öffnet nach dem Zeitfenster wieder', () => {
      const bremse = new Anmeldebremse(eng);
      for (let i = 0; i < 5; i++) {
        bremse.fehlversuch({ email: `opfer${i}@zeller-tore.de`, ip: '203.0.113.7' }, i * 1000);
      }

      expect(
        bremse.pruefen({ email: 'opfer99@zeller-tore.de', ip: '203.0.113.7' }, 11 * MIN).erlaubt,
      ).toBe(true);
    });

    it('kommt ohne bekannte Herkunft zurecht', () => {
      // Fehlt `x-forwarded-for`, bleibt die Kontobremse – abstürzen darf sie
      // deshalb nicht.
      const bremse = new Anmeldebremse(eng);
      const ohne = { email: 'chef@zeller-tore.de' };

      expect(() => bremse.fehlversuch(ohne, 0)).not.toThrow();
      expect(bremse.pruefen(ohne, 1000).erlaubt).toBe(true);
    });

    it('läßt die Herkunft nach geglückter Anmeldung gezählt', () => {
      // Sonst genügte ein einziges bekanntes Passwort, um den Zähler eines
      // Angriffs zurückzusetzen.
      const bremse = new Anmeldebremse(eng);
      for (let i = 0; i < 5; i++) {
        bremse.fehlversuch({ email: `opfer${i}@zeller-tore.de`, ip: '203.0.113.7' }, i * 1000);
      }
      bremse.erfolg({ email: 'opfer0@zeller-tore.de', ip: '203.0.113.7' });

      expect(
        bremse.pruefen({ email: 'opfer9@zeller-tore.de', ip: '203.0.113.7' }, 6000).erlaubt,
      ).toBe(false);
    });
  });

  describe('Schutz der Bremse selbst', () => {
    it('läßt die Tabelle nicht ins Unendliche wachsen', () => {
      // Ohne Deckel ließe sich die Bremse gegen den Server wenden: Millionen
      // erfundener Adressen, für jede ein Eintrag.
      const bremse = new Anmeldebremse({ ...eng, hoechstzahlEintraege: 50 });
      for (let i = 0; i < 500; i++) {
        bremse.fehlversuch({ email: `nummer${i}@example.de` }, i * 10);
      }

      expect(bremse.stand().konten).toBeLessThanOrEqual(51);
    });

    it('wirft beim Aufräumen zuerst das Abgelaufene weg', () => {
      const bremse = new Anmeldebremse({ ...eng, hoechstzahlEintraege: 10 });
      for (let i = 0; i < 10; i++) bremse.fehlversuch({ email: `alt${i}@example.de` }, i);

      // Weit nach dem Fenster: Die alten Einträge sind wertlos.
      for (let i = 0; i < 5; i++) {
        bremse.fehlversuch({ email: `neu${i}@example.de` }, 11 * MIN + i);
      }

      expect(bremse.stand().konten).toBeLessThanOrEqual(10);
      expect(bremse.pruefen({ email: 'neu0@example.de' }, 11 * MIN + 10).erlaubt).toBe(true);
    });

    it('behält eine laufende Sperre auch beim Aufräumen', () => {
      // Das wäre der stille Ausweg: sich freiräumen lassen, indem man die
      // Tabelle mit erfundenen Adressen flutet.
      const bremse = new Anmeldebremse({ ...eng, hoechstzahlEintraege: 20 });
      for (let i = 0; i < 3; i++) bremse.fehlversuch(konto, i);

      for (let i = 0; i < 200; i++) {
        bremse.fehlversuch({ email: `flut${i}@example.de` }, 100 + i);
      }

      expect(bremse.pruefen(konto, 400).erlaubt).toBe(false);
    });
  });

  describe('Voreinstellung', () => {
    it('sperrt nach fünf Fehlversuchen für eine Minute', () => {
      const bremse = new Anmeldebremse();
      for (let i = 0; i < 4; i++) {
        expect(bremse.fehlversuch(konto, i * 1000).gesperrt).toBe(false);
      }

      expect(bremse.fehlversuch(konto, 5000)).toEqual({ gesperrt: true, wartenSek: 60 });
    });

    it('läßt genug Spielraum für ein vertipptes Passwort', () => {
      // Vier Fehlgriffe ohne Folgen: Wer sein Passwort dreimal falsch tippt,
      // soll nicht ausgesperrt werden.
      expect(GRENZEN.versucheBisSperre).toBeGreaterThanOrEqual(5);
    });
  });
});
