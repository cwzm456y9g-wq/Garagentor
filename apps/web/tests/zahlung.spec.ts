import { InvoiceStatus, Prisma } from '@prisma/client';

/**
 * Zahlungen dürfen einander nicht überschreiben.
 *
 * Der offene Betrag wurde früher vor der Transaktion gelesen und der neue
 * Gesamtstand daraus ausgerechnet. Zwei gleichzeitige Buchungen sahen denselben
 * offenen Posten: Bei 1.000 € offen kamen zweimal 600 € durch, und die zweite
 * überschrieb die erste – zwei Zahlungen über zusammen 1.200 € in der Liste,
 * aber 600 € als gezahlt vermerkt. Ein Doppelklick genügt dafür.
 *
 * Zwei Dinge halten das jetzt: die Sperre auf der Rechnungszeile, und die
 * Summe, die aus den Zahlungen selbst kommt statt aus dem fortgeschriebenen
 * Feld. Was gebucht ist, steht in der Liste – das Feld ist nur die
 * Zusammenfassung und darf ihr nicht widersprechen.
 */
const prismaMock = {
  invoice: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
  payment: { create: jest.fn(), delete: jest.fn(), findFirst: jest.fn(), aggregate: jest.fn() },
  dunning: { updateMany: jest.fn() },
  setting: { findUnique: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

jest.mock('@/server/prisma', () => ({ prisma: prismaMock }));
jest.mock('../src/server/dienste/common/audit/audit.service', () => ({
  audit: { record: jest.fn() },
}));

process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

import { invoicesService } from '@/server/dienste/invoices/invoices.service';

const dezimal = (wert: number) => new Prisma.Decimal(wert);

function rechnung(felder: Record<string, unknown> = {}) {
  return {
    id: 'rechnung-1',
    invoiceNumber: 'RE-2026-0009',
    status: InvoiceStatus.OFFEN,
    date: new Date('2026-08-01'),
    dueDate: new Date('2026-08-15'),
    grossTotal: dezimal(1000),
    deductedAmount: dezimal(0),
    paidAmount: dezimal(0),
    skontoAmount: dezimal(0),
    skontoPercent: dezimal(0),
    skontoDays: 0,
    ...felder,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.setting.findUnique.mockResolvedValue(null);
  prismaMock.$queryRaw.mockResolvedValue([{ id: 'rechnung-1' }]);
  prismaMock.invoice.findUnique.mockResolvedValue(rechnung());
  prismaMock.invoice.findUniqueOrThrow.mockResolvedValue(rechnung());
  prismaMock.payment.create.mockResolvedValue({});
  prismaMock.payment.delete.mockResolvedValue({});
  prismaMock.invoice.update.mockResolvedValue({});
  prismaMock.dunning.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));
});

describe('Zahlung buchen', () => {
  it('sperrt die Rechnung, bevor es den offenen Betrag liest', async () => {
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: dezimal(600) } });

    await invoicesService.addPayment('rechnung-1', { amount: 600 } as never);

    const [vorlage] = prismaMock.$queryRaw.mock.calls[0] as [string[]];
    expect(vorlage.join('?')).toContain('FOR UPDATE');
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.invoice.findUnique.mock.invocationCallOrder[0],
    );
  });

  it('schreibt die Summe der Zahlungen fort, nicht den alten Stand plus Betrag', async () => {
    // Der gespeicherte Stand sagt 0, tatsächlich gebucht sind schon 600 –
    // genau die Lage, die eine überholte Buchung hinterlässt.
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: dezimal(900) } });

    await invoicesService.addPayment('rechnung-1', { amount: 300 } as never);

    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paidAmount: 900 }) }),
    );
  });

  it('weist mehr zurück, als offen ist', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(rechnung({ paidAmount: dezimal(900) }));

    await expect(
      invoicesService.addPayment('rechnung-1', { amount: 300 } as never),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Der Zahlbetrag übersteigt den offenen Betrag von 100.00 €.',
    });
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });

  it('bucht nichts auf einen Entwurf', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(rechnung({ status: InvoiceStatus.ENTWURF }));

    await expect(
      invoicesService.addPayment('rechnung-1', { amount: 10 } as never),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('bucht nichts auf eine stornierte Rechnung', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(rechnung({ status: InvoiceStatus.STORNIERT }));

    await expect(
      invoicesService.addPayment('rechnung-1', { amount: 10 } as never),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('erledigt offene Mahnungen, sobald ausgeglichen ist', async () => {
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: dezimal(1000) } });

    await invoicesService.addPayment('rechnung-1', { amount: 1000 } as never);

    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: InvoiceStatus.BEZAHLT }) }),
    );
    expect(prismaMock.dunning.updateMany).toHaveBeenCalled();
  });
});

describe('Zahlung entfernen', () => {
  it('rechnet den Stand aus den verbliebenen Zahlungen neu', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: 'zahlung-1', amount: dezimal(300) });
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: dezimal(600) } });

    await invoicesService.removePayment('rechnung-1', 'zahlung-1');

    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: 600,
          status: InvoiceStatus.TEILBEZAHLT,
        }),
      }),
    );
  });

  it('setzt die Rechnung wieder auf offen, wenn nichts mehr gebucht ist', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: 'zahlung-1', amount: dezimal(300) });
    // Kein _sum: So antwortet die Datenbank, wenn keine Zahlung mehr übrig ist.
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });

    await invoicesService.removePayment('rechnung-1', 'zahlung-1');

    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paidAmount: 0, status: InvoiceStatus.OFFEN }),
      }),
    );
  });

  it('sperrt dabei dieselbe Zeile wie das Buchen', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: 'zahlung-1', amount: dezimal(300) });
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });

    await invoicesService.removePayment('rechnung-1', 'zahlung-1');

    const [vorlage] = prismaMock.$queryRaw.mock.calls[0] as [string[]];
    expect(vorlage.join('?')).toContain('FOR UPDATE');
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.payment.findFirst.mock.invocationCallOrder[0],
    );
  });
});
