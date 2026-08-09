import { Prisma, QuoteStatus } from '@prisma/client';

/**
 * Ein angenommenes Angebot darf nur einmal zu einem Auftrag werden.
 *
 * Der Status allein reicht dafür nicht: „angenommen" bleibt „angenommen",
 * auch nachdem der Auftrag entstanden ist. Genau daran lag es, dass ein
 * zweiter Aufruf denselben Auftrag ein zweites Mal anlegte – mit eigener
 * Auftragsnummer, eigenen Positionen und doppeltem Umsatz in der Auswertung.
 *
 * Geprüft wird deshalb beides: dass der zweite Versuch abgewiesen wird, und
 * dass die Zeile des Angebots dabei gesperrt wird. Ohne diese Sperre sähen
 * zwei gleichzeitige Aufrufe – ein Doppelklick genügt – beide „noch kein
 * Auftrag" und kämen beide durch.
 */
const prismaMock = {
  quote: { findUnique: jest.fn() },
  order: { findFirst: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

jest.mock('@/server/prisma', () => ({ prisma: prismaMock }));
jest.mock('../src/server/dienste/common/numbering/number-range.service', () => ({
  numbers: { next: jest.fn().mockResolvedValue('AU-2026-0001') },
}));

process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

import { quotesService } from '@/server/dienste/quotes/quotes.service';

const dezimal = (wert: number) => new Prisma.Decimal(wert);

const angebot = {
  id: 'angebot-1',
  quoteNumber: 'AN-2026-0002',
  status: QuoteStatus.ANGENOMMEN,
  customerId: 'kunde-1',
  siteId: null,
  subject: 'Sectionaltor erneuern',
  introText: null,
  discountPercent: dezimal(0),
  items: [
    {
      id: 'pos-1',
      position: 1,
      type: 'LEISTUNG',
      articleId: null,
      title: 'Montage',
      description: null,
      quantity: dezimal(1),
      unit: 'Stk',
      unitPrice: dezimal(1000),
      discountPercent: dezimal(0),
      vatRate: dezimal(19),
      optional: false,
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.quote.findUnique.mockResolvedValue(angebot);
  prismaMock.$queryRaw.mockResolvedValue([{ id: angebot.id }]);
  prismaMock.order.create.mockResolvedValue({ id: 'auftrag-1', orderNumber: 'AU-2026-0001' });
  // Die Transaktion wird durchgereicht; geprüft wird, was in ihr geschieht.
  prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));
});

describe('Angebot in Auftrag umwandeln', () => {
  it('legt beim ersten Mal einen Auftrag an', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);

    const auftrag = await quotesService.convertToOrder('angebot-1', {});

    expect(auftrag).toMatchObject({ orderNumber: 'AU-2026-0001' });
    expect(prismaMock.order.create).toHaveBeenCalledTimes(1);
  });

  it('weist einen zweiten Versuch ab und nennt den bestehenden Auftrag', async () => {
    prismaMock.order.findFirst.mockResolvedValue({ orderNumber: 'AU-2026-0001' });

    await expect(quotesService.convertToOrder('angebot-1', {})).rejects.toMatchObject({
      status: 409,
      message: 'Zum Angebot AN-2026-0002 besteht bereits der Auftrag AU-2026-0001.',
    });
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it('sperrt die Zeile des Angebots, bevor es nachsieht', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);

    await quotesService.convertToOrder('angebot-1', {});

    const [vorlage] = prismaMock.$queryRaw.mock.calls[0] as [string[]];
    expect(vorlage.join('?')).toContain('FOR UPDATE');
    // Erst sperren, dann nachsehen – die andere Reihenfolge schützt nicht.
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.order.findFirst.mock.invocationCallOrder[0],
    );
  });

  it('lässt ein nicht angenommenes Angebot gar nicht erst in die Transaktion', async () => {
    prismaMock.quote.findUnique.mockResolvedValue({
      ...angebot,
      status: QuoteStatus.VERSENDET,
    });

    await expect(quotesService.convertToOrder('angebot-1', {})).rejects.toMatchObject({
      status: 409,
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
