import { CustomerType, DunningLevel, DunningStatus, InvoiceStatus, Prisma } from '@prisma/client';

/**
 * Eine Mahnung von Hand darf keine Stufe überspringen und keine doppelt
 * vergeben.
 *
 * Die nächste Stufe leitet sich aus der bisherigen ab. Wurde die außerhalb der
 * Transaktion gelesen, sahen zwei gleichzeitige Aufrufe dieselbe – zwei
 * Mahnungen derselben Stufe wurden daraus nicht, dafür sorgt die Eindeutigkeit
 * in der Datenbank, aber die zweite kam als nackter „Datensatz existiert
 * bereits"-Fehler zurück.
 *
 * Der zweite Punkt wog schwerer: Die Karenzfrist, nach der der nächtliche Lauf
 * arbeitet, fehlte dem Weg von Hand. Zwei Klicks kurz nacheinander haben den
 * Kunden von der Zahlungserinnerung direkt auf die erste Mahnung gehoben,
 * samt Gebühr und Verzugszinsen.
 */
const prismaMock = {
  invoice: { findUnique: jest.fn(), update: jest.fn() },
  dunning: { create: jest.fn() },
  setting: { findUnique: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

jest.mock('@/server/prisma', () => ({ prisma: prismaMock }));

process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

import { dunningService } from '@/server/dienste/invoices/dunning.service';

const dezimal = (wert: number) => new Prisma.Decimal(wert);
const TAG = 24 * 60 * 60 * 1000;

function rechnung(dunnings: unknown[] = [], felder: Record<string, unknown> = {}) {
  return {
    id: 'rechnung-1',
    invoiceNumber: 'RE-2026-0009',
    status: InvoiceStatus.UEBERFAELLIG,
    // Lange überfällig, damit die Stufen fällig sind.
    date: new Date(Date.now() - 120 * TAG),
    dueDate: new Date(Date.now() - 100 * TAG),
    grossTotal: dezimal(1000),
    deductedAmount: dezimal(0),
    paidAmount: dezimal(0),
    dunningLevel: null,
    customer: { type: CustomerType.GEWERBE },
    dunnings,
    ...felder,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.setting.findUnique.mockResolvedValue(null);
  prismaMock.$queryRaw.mockResolvedValue([{ id: 'rechnung-1' }]);
  prismaMock.dunning.create.mockImplementation(({ data }: { data: { level: DunningLevel } }) => ({
    id: 'mahnung-1',
    ...data,
  }));
  prismaMock.invoice.update.mockResolvedValue({});
  prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));
});

describe('Mahnung von Hand anlegen', () => {
  it('sperrt die Rechnung, bevor es die bisherige Stufe liest', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(rechnung());

    await dunningService.createForInvoice('rechnung-1');

    const [vorlage] = prismaMock.$queryRaw.mock.calls[0] as [string[]];
    expect(vorlage.join('?')).toContain('FOR UPDATE');
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.invoice.findUnique.mock.invocationCallOrder[0],
    );
  });

  it('wartet die Frist der letzten Mahnung ab', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(
      rechnung([
        {
          level: DunningLevel.ZAHLUNGSERINNERUNG,
          status: DunningStatus.VERSENDET,
          // Frist läuft noch.
          dueDate: new Date(Date.now() + 5 * TAG),
        },
      ]),
    );

    await expect(dunningService.createForInvoice('rechnung-1')).rejects.toMatchObject({
      status: 409,
    });
    expect(prismaMock.dunning.create).not.toHaveBeenCalled();
  });

  it('mahnt weiter, sobald die Frist abgelaufen ist', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(
      rechnung(
        [
          {
            level: DunningLevel.ZAHLUNGSERINNERUNG,
            status: DunningStatus.VERSENDET,
            dueDate: new Date(Date.now() - 1 * TAG),
          },
        ],
        { dunningLevel: DunningLevel.ZAHLUNGSERINNERUNG },
      ),
    );

    const mahnung = await dunningService.createForInvoice('rechnung-1');

    expect(mahnung).toMatchObject({ level: DunningLevel.MAHNUNG_1 });
  });

  it('lässt eine ausdrücklich angeforderte Stufe trotz laufender Frist zu', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(
      rechnung([
        {
          level: DunningLevel.ZAHLUNGSERINNERUNG,
          status: DunningStatus.VERSENDET,
          dueDate: new Date(Date.now() + 5 * TAG),
        },
      ]),
    );

    // Wer die Stufe angibt, meint es so – das ist ein bewusster Schritt.
    const mahnung = await dunningService.createForInvoice('rechnung-1', DunningLevel.MAHNUNG_1);

    expect(mahnung).toMatchObject({ level: DunningLevel.MAHNUNG_1 });
  });

  it('weist dieselbe Stufe ein zweites Mal ab', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(
      rechnung([
        {
          level: DunningLevel.MAHNUNG_1,
          status: DunningStatus.VERSENDET,
          dueDate: new Date(Date.now() - 1 * TAG),
        },
      ]),
    );

    await expect(
      dunningService.createForInvoice('rechnung-1', DunningLevel.MAHNUNG_1),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Zur Rechnung RE-2026-0009 besteht bereits eine Mahnung der Stufe MAHNUNG_1.',
    });
  });

  it('mahnt keine Rechnung ohne offenen Betrag', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(rechnung([], { paidAmount: dezimal(1000) }));

    await expect(dunningService.createForInvoice('rechnung-1')).rejects.toMatchObject({
      status: 409,
    });
  });
});
