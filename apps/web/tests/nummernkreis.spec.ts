/**
 * Belegnummern müssen eindeutig und lückenlos sein.
 *
 * Der Zähler wurde früher gelesen und danach mit einem ausgerechneten Wert
 * überschrieben. Zwei Belege, die im selben Moment entstehen, lasen denselben
 * Stand und bekamen dieselbe Nummer. Gerettet hat nur die Eindeutigkeit in der
 * Datenbank – als Fehlermeldung: Von sechs gleichzeitig angelegten Angeboten
 * kam eines durch, fünf scheiterten. Zwei Leute im Büro genügen dafür.
 *
 * Jetzt zählt ein einziges UPDATE hoch und sperrt die Zeile dabei. Geprüft
 * wird genau das – dass hochgezählt und nicht gesetzt wird –, dazu die
 * Formatierung und der Jahreswechsel.
 */
const prismaMock = {
  numberRange: { findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn() },
};

jest.mock('@/server/prisma', () => ({ prisma: prismaMock }));

process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

import { numbers } from '@/server/dienste/common/numbering/number-range.service';

const JAHR = new Date().getFullYear();

function kreis(felder: Partial<Record<string, unknown>> = {}) {
  return {
    entity: 'QUOTE',
    prefix: 'AN-',
    suffix: '',
    padding: 4,
    yearlyReset: true,
    nextNumber: 12,
    currentYear: JAHR,
    ...felder,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Nächste Belegnummer', () => {
  it('zählt hoch, statt einen ausgerechneten Wert zu setzen', async () => {
    prismaMock.numberRange.findUnique.mockResolvedValue(kreis());
    prismaMock.numberRange.update.mockResolvedValue(kreis({ nextNumber: 13 }));

    const nummer = await numbers.next('QUOTE');

    expect(nummer).toBe(`AN-${JAHR}-0012`);
    // Das `increment` ist der Kern: Es geschieht in der Datenbank und sperrt
    // die Zeile. Ein gesetzter Wert käme aus einem veralteten Stand.
    expect(prismaMock.numberRange.update).toHaveBeenCalledWith({
      where: { entity: 'QUOTE' },
      data: { nextNumber: { increment: 1 } },
    });
  });

  it('füllt auf die eingestellte Stellenzahl auf', async () => {
    prismaMock.numberRange.findUnique.mockResolvedValue(
      kreis({ prefix: 'K-', padding: 5, yearlyReset: false, nextNumber: 7 }),
    );
    prismaMock.numberRange.update.mockResolvedValue(
      kreis({ prefix: 'K-', padding: 5, yearlyReset: false, nextNumber: 8 }),
    );

    // Ohne Jahresreset steht kein Jahr in der Nummer.
    await expect(numbers.next('CUSTOMER')).resolves.toBe('K-00007');
  });

  it('beginnt im neuen Jahr wieder bei eins', async () => {
    prismaMock.numberRange.findUnique.mockResolvedValue(kreis({ currentYear: JAHR - 1 }));
    prismaMock.numberRange.update
      .mockResolvedValueOnce(kreis({ currentYear: JAHR - 1, nextNumber: 13 }))
      .mockResolvedValueOnce(kreis({ currentYear: JAHR, nextNumber: 2 }));

    await expect(numbers.next('QUOTE')).resolves.toBe(`AN-${JAHR}-0001`);
    // Der Zähler steht danach auf 2: Die 1 ist gerade vergeben worden.
    expect(prismaMock.numberRange.update).toHaveBeenLastCalledWith({
      where: { entity: 'QUOTE' },
      data: { nextNumber: 2, currentYear: JAHR },
    });
  });

  it('legt einen fehlenden Kreis an, ohne einen bestehenden zu überschreiben', async () => {
    prismaMock.numberRange.findUnique.mockResolvedValue(null);
    prismaMock.numberRange.upsert.mockResolvedValue(kreis({ nextNumber: 1 }));
    prismaMock.numberRange.update.mockResolvedValue(kreis({ nextNumber: 2 }));

    await expect(numbers.next('QUOTE')).resolves.toBe(`AN-${JAHR}-0001`);
    // `update: {}` – legen zwei Aufrufe den Kreis gleichzeitig an, findet der
    // zweite den ersten vor und verändert ihn nicht.
    expect(prismaMock.numberRange.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { entity: 'QUOTE' }, update: {} }),
    );
  });
});
