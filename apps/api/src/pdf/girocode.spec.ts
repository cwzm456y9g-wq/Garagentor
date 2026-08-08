import { buildGiroCodePayload } from './girocode';

const basis = {
  name: 'Tortechnik Weber GmbH',
  iban: 'DE02 4005 0150 0000 1234 56',
  bic: 'WELADED1MST',
  amount: 371.24,
  reference: 'Rechnung RE-2026-0001',
};

describe('GiroCode', () => {
  it('hält die Zeilenfolge der EPC-Spezifikation ein', () => {
    const zeilen = buildGiroCodePayload(basis)?.split('\n');

    expect(zeilen).toEqual([
      'BCD',
      '002',
      '1',
      'SCT',
      'WELADED1MST',
      'Tortechnik Weber GmbH',
      'DE02400501500000123456',
      'EUR371.24',
      '',
      '',
      'Rechnung RE-2026-0001',
    ]);
  });

  it('entfernt Leerzeichen aus der IBAN', () => {
    expect(buildGiroCodePayload(basis)).toContain('DE02400501500000123456');
  });

  it('schreibt den Betrag mit zwei Nachkommastellen und Punkt', () => {
    // Banking-Apps erwarten das Punktformat, nicht das deutsche Komma.
    expect(buildGiroCodePayload({ ...basis, amount: 1000 })).toContain('EUR1000.00');
    expect(buildGiroCodePayload({ ...basis, amount: 0.5 })).toContain('EUR0.50');
  });

  it('kommt ohne BIC aus', () => {
    const zeilen = buildGiroCodePayload({ ...basis, bic: null })?.split('\n');
    expect(zeilen?.[4]).toBe('');
    expect(zeilen?.[6]).toBe('DE02400501500000123456');
  });

  it('kürzt Namen und Verwendungszweck auf die zulässige Länge', () => {
    const zeilen = buildGiroCodePayload({
      ...basis,
      name: 'A'.repeat(100),
      reference: 'B'.repeat(200),
    })?.split('\n');

    expect(zeilen?.[5]).toHaveLength(70);
    expect(zeilen?.[10]).toHaveLength(140);
  });

  it('verweigert den Code ohne IBAN oder Empfänger', () => {
    expect(buildGiroCodePayload({ ...basis, iban: '' })).toBeNull();
    expect(buildGiroCodePayload({ ...basis, name: '   ' })).toBeNull();
  });

  it('verweigert Beträge außerhalb des zulässigen Bereichs', () => {
    // Unter einem Cent und über der Obergrenze lehnt die Spezifikation ab;
    // ein unbrauchbarer Code wäre schlimmer als gar keiner.
    expect(buildGiroCodePayload({ ...basis, amount: 0 })).toBeNull();
    expect(buildGiroCodePayload({ ...basis, amount: -5 })).toBeNull();
    expect(buildGiroCodePayload({ ...basis, amount: 1_000_000_000 })).toBeNull();
    expect(buildGiroCodePayload({ ...basis, amount: Number.NaN })).toBeNull();
  });
});
