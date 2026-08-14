import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Die Dokumente in der Sicherung.
 *
 * Dieser Zweig läßt sich in der Entwicklung nicht durchspielen: Die Dateien
 * liegen in der Ablage des Anbieters, und die steht hier nicht zur Verfügung.
 * Statt ihn deshalb ungeprüft zu lassen, treten hier zwei Attrappen an die
 * Stelle von Datenbank und Ablage – geprüft wird, was der Dienst daraus baut.
 */

const dokumente = [
  { id: 'd1', originalName: 'anlagenfoto.jpg', size: 12, category: 'FOTO' },
  { id: 'd2', originalName: 'kaputt.jpg', size: 12, category: 'FOTO' },
  { id: 'd3', originalName: 'riesig.tif', size: 500 * 1024 * 1024, category: 'SONSTIGES' },
  { id: 'd4', originalName: 'un/gültig: name?.pdf', size: 5, category: 'RECHNUNG' },
];

jest.mock('@/server/prisma', () => ({
  // Jede Tabelle antwortet leer; nur das Dokumentenverzeichnis ist gefüllt.
  prisma: new Proxy(
    {},
    {
      get: (_ziel, name: string) => ({
        findMany: async () => (name === 'document' ? dokumente : []),
      }),
    },
  ),
}));

jest.mock('@/server/dienste/documents/documents.service', () => ({
  documents: {
    fileFor: async (id: string) => {
      if (id === 'd2') throw new Error('Datei fehlt in der Ablage');
      return { inhalt: Buffer.from('Bildinhalt') };
    },
  },
}));

/** Packt das Archiv aus und gibt die enthaltenen Pfade zurück. */
function auspacken(archiv: Buffer): { pfade: string[]; ordner: string } {
  const ordner = mkdtempSync(join(tmpdir(), 'sicherung-doks-'));
  const datei = join(ordner, 'sicherung.zip');
  writeFileSync(datei, archiv);

  expect(execFileSync('unzip', ['-t', datei]).toString()).toContain('No errors');
  execFileSync('unzip', ['-q', '-o', datei, '-d', ordner]);

  const pfade = execFileSync('unzip', ['-Z1', datei]).toString().trim().split('\n');
  return { pfade, ordner };
}

describe('Sicherung mit Dokumenten', () => {
  it('legt lesbare Dateien nach Kategorie ab und übergeht die anderen', async () => {
    const { sicherung } = await import('@/server/dienste/exports/sicherung.service');
    const { inhalt } = await sicherung.archiv(true);
    const { pfade, ordner } = auspacken(inhalt);

    const abgelegt = pfade.filter((pfad) => pfad.startsWith('dokumente/'));

    // Die lesbare Datei ist da – mit Kennung im Namen, damit zwei gleich
    // benannte Fotos einander nicht überschreiben.
    expect(abgelegt).toContain('dokumente/FOTO/d1-anlagenfoto.jpg');
    expect(readFileSync(join(ordner, 'dokumente/FOTO/d1-anlagenfoto.jpg'), 'utf8')).toBe(
      'Bildinhalt',
    );

    // Die nicht lesbare fehlt, hält die Sicherung aber nicht auf.
    expect(abgelegt).not.toContain('dokumente/FOTO/d2-kaputt.jpg');

    // Die zu große bleibt draußen, damit das Archiv handhabbar bleibt.
    expect(abgelegt.some((pfad) => pfad.includes('riesig'))).toBe(false);

    // Zeichen, die in keinen Dateinamen gehören, sind ersetzt.
    expect(abgelegt).toContain('dokumente/RECHNUNG/d4-un_gültig_ name_.pdf');
  });

  it('benennt im Liesmich, was fehlt – Schweigen wäre hier das Schlimmste', async () => {
    const { sicherung } = await import('@/server/dienste/exports/sicherung.service');
    const { inhalt } = await sicherung.archiv(true);
    const { ordner } = auspacken(inhalt);

    const liesmich = readFileSync(join(ordner, 'LIESMICH.txt'), 'utf8');

    expect(liesmich).toContain('Nicht mitgesichert werden konnten');
    expect(liesmich).toContain('kaputt.jpg (nicht lesbar)');
    expect(liesmich).toContain('riesig.tif (zu groß für dieses Archiv)');
    // Zwei der vier waren lesbar und klein genug: das Anlagenfoto und die PDF.
    expect(liesmich).toContain('2 Datei(en)');
  });

  it('läßt die Dateien ohne den Haken ganz weg und sagt das auch', async () => {
    const { sicherung } = await import('@/server/dienste/exports/sicherung.service');
    const { inhalt, dateiname } = await sicherung.archiv(false);
    const { pfade, ordner } = auspacken(inhalt);

    expect(pfade.some((pfad) => pfad.startsWith('dokumente/'))).toBe(false);
    expect(readFileSync(join(ordner, 'LIESMICH.txt'), 'utf8')).toContain('NICHT enthalten');
    expect(dateiname).toMatch(/^Garagentor-Sicherung-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/);
  });

  it('legt jede Tabelle zweimal ab – zum Ansehen und zum Einspielen', async () => {
    const { sicherung } = await import('@/server/dienste/exports/sicherung.service');
    const { inhalt } = await sicherung.archiv(false);
    const { pfade } = auspacken(inhalt);

    const csv = pfade.filter((pfad) => pfad.startsWith('tabellen/'));
    const json = pfade.filter((pfad) => pfad.startsWith('daten/'));

    expect(csv.length).toBe(json.length);
    expect(csv.length).toBeGreaterThan(30);
    expect(pfade).toContain('LIESMICH.txt');
    expect(pfade).toContain('tabellen/customers.csv');
    expect(pfade).toContain('daten/customers.json');
    // Anmeldungen gehören nicht in eine Sicherung.
    expect(pfade).not.toContain('daten/refresh_tokens.json');
  });
});
