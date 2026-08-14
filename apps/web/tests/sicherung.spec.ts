import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { csvDatei, csvFeld, fuerCsv, fuerJson } from '@/server/dienste/exports/tabelle';
import { crc32, zipBauen } from '@/server/dienste/exports/zip';

/** Prisma liefert Beträge als Decimal; hier nachgebildet. */
const decimal = (wert: number) => ({ toNumber: () => wert });

describe('Sicherung', () => {
  describe('Werte für die CSV', () => {
    it('schreibt Zahlen in deutscher Schreibweise', () => {
      // Sonst bleibt der Betrag in einem deutschen Excel Text und läßt sich
      // nicht summieren – die Sicherung wäre lesbar, aber nicht auswertbar.
      expect(fuerCsv(decimal(1234.5))).toBe('1234,5');
      expect(fuerCsv(19)).toBe('19');
    });

    it('gruppiert Tausender nicht', () => {
      // Ein Punkt als Tausendertrennung wäre im CSV nicht von einem
      // Dezimalpunkt zu unterscheiden.
      expect(fuerCsv(1234567.89)).toBe('1234567,89');
    });

    it('schreibt Wahrheitswerte als Wort', () => {
      expect(fuerCsv(true)).toBe('ja');
      expect(fuerCsv(false)).toBe('nein');
    });

    it('läßt leere Felder leer, statt „null“ zu schreiben', () => {
      expect(fuerCsv(null)).toBe('');
      expect(fuerCsv(undefined)).toBe('');
    });

    it('faßt jedes Feld in Anführungszeichen und verdoppelt eigene', () => {
      expect(csvFeld('Halle 3')).toBe('"Halle 3"');
      expect(csvFeld('Tor "Ost"')).toBe('"Tor ""Ost"""');
    });

    it('hält Semikolon und Zeilenumbruch im Feld', () => {
      const zeile = csvDatei(['bemerkung'], [{ bemerkung: 'erst dies;\ndann das' }]);

      // Kopfzeile und eine Datenzeile. Der Umbruch im Text ist ein einzelnes
      // \n und trennt deshalb keinen Datensatz – genau darum steht als
      // Satztrenner \r\n und nicht \n.
      expect(zeile.trimEnd().split('\r\n')).toHaveLength(2);
      expect(zeile).toContain('"erst dies;\ndann das"');
    });

    it('beginnt mit der Byte-Reihenfolge-Marke für Excel', () => {
      expect(csvDatei(['a'], []).startsWith('\uFEFF')).toBe(true);
    });
  });

  describe('Werte für die JSON', () => {
    it('hält Zahlen als Zahlen und Zeitpunkte nach ISO 8601', () => {
      expect(fuerJson(decimal(1234.5))).toBe(1234.5);
      expect(fuerJson(new Date('2026-08-14T09:30:00.000Z'))).toBe('2026-08-14T09:30:00.000Z');
    });

    it('unterscheidet fehlend nicht von leer, sondern schreibt beides als null', () => {
      expect(fuerJson(null)).toBeNull();
      expect(fuerJson(undefined)).toBeNull();
    });
  });

  describe('Archiv', () => {
    it('berechnet die Prüfsumme wie im Format vorgesehen', () => {
      // Bekannter Wert: CRC-32 von „123456789".
      expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
      expect(crc32(Buffer.alloc(0))).toBe(0);
    });

    it('läßt sich von unzip lesen und gibt die Dateien unverändert zurück', () => {
      const inhalt = 'Straße;Grüße\r\nÄpfel;Öl\r\n';
      const gross = Buffer.alloc(200_000, 0x41);

      const archiv = zipBauen([
        { name: 'LIESMICH.txt', inhalt: 'Sicherung der Garagentor-Anwendung' },
        { name: 'tabellen/kunden.csv', inhalt },
        { name: 'dokumente/FOTO/tor.bin', inhalt: gross },
      ]);

      const ordner = mkdtempSync(join(tmpdir(), 'sicherung-'));
      const datei = join(ordner, 'sicherung.zip');
      writeFileSync(datei, archiv);

      // Erst die Prüfung des Archivs selbst, dann der Vergleich der Inhalte.
      expect(execFileSync('unzip', ['-t', datei]).toString()).toContain('No errors');

      execFileSync('unzip', ['-q', '-o', datei, '-d', ordner]);
      expect(readFileSync(join(ordner, 'tabellen/kunden.csv'), 'utf8')).toBe(inhalt);
      expect(readFileSync(join(ordner, 'LIESMICH.txt'), 'utf8')).toContain('Garagentor');
      expect(readFileSync(join(ordner, 'dokumente/FOTO/tor.bin')).equals(gross)).toBe(true);
    });

    it('packt tatsächlich – der große Eintrag schrumpft deutlich', () => {
      const archiv = zipBauen([{ name: 'a.txt', inhalt: Buffer.alloc(100_000, 0x41) }]);

      expect(archiv.byteLength).toBeLessThan(5_000);
    });

    it('kommt mit einem leeren Archiv zurecht', () => {
      // Nur der Abschlußblock: 22 Byte.
      expect(zipBauen([]).byteLength).toBe(22);
    });
  });

  describe('Vollständigkeit', () => {
    /**
     * Der eigentliche Zweck dieser Prüfung: Wer morgen eine Tabelle ins
     * Datenmodell aufnimmt, soll sie nicht aus Versehen aus der Sicherung
     * heraushalten. Fällt der Test aus, ist das die Frage „gehört das hinein?"
     * – und nicht der stille Verlust einer Tabelle, der erst auffällt, wenn
     * man die Sicherung braucht.
     */
    const AUSGENOMMEN = ['RefreshToken'];

    it('sichert jede Tabelle des Datenmodells', () => {
      const modelle = Prisma.dmmf.datamodel.models.map((modell) => modell.name);
      const gesichert = modelle.filter((name) => !AUSGENOMMEN.includes(name));

      expect(modelle.length).toBeGreaterThan(30);
      expect(gesichert).toHaveLength(modelle.length - AUSGENOMMEN.length);
      expect(gesichert).toContain('Customer');
      expect(gesichert).toContain('Invoice');
      expect(gesichert).toContain('Inspection');
      expect(gesichert).toContain('MaintenanceContract');
    });

    it('nimmt Anmeldungen bewußt aus', () => {
      expect(AUSGENOMMEN).toContain('RefreshToken');
    });
  });

  describe('Geheimnisse', () => {
    const GEHEIM = /passwort|password|hash|token|secret|geheim/i;

    it('erkennt das Kennwortfeld des Benutzers', () => {
      const user = Prisma.dmmf.datamodel.models.find((modell) => modell.name === 'User');
      const felder = user!.fields.map((feld) => feld.name);
      const geschwaerzt = felder.filter((feld) => GEHEIM.test(feld));

      expect(felder).toContain('passwordHash');
      expect(geschwaerzt).toContain('passwordHash');
    });

    it('läßt gewöhnliche Felder in Ruhe', () => {
      for (const feld of ['email', 'firstName', 'lastName', 'role', 'createdAt']) {
        expect(GEHEIM.test(feld)).toBe(false);
      }
    });

    it('griffe auch bei einem neuen Geheimnis', () => {
      // Die Regel greift über den Namen, damit ein künftiges Feld nicht am Tag
      // seiner Einführung in jeder Sicherung stünde.
      for (const feld of ['apiSecret', 'resetToken', 'kennwortHash', 'geheimschluessel']) {
        expect(GEHEIM.test(feld)).toBe(true);
      }
    });
  });
});
