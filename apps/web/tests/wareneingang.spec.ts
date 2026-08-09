import { Prisma, PurchaseOrderStatus } from '@prisma/client';

/**
 * Ein Wareneingang darf nie mehr buchen, als offen ist.
 *
 * Die Prüfung stand früher vor der Transaktion. Was noch offen ist, kam damit
 * aus einem Stand, den ein zweiter Aufruf längst überholt haben konnte: Zwei
 * gleichzeitige Meldungen sahen beide dieselbe offene Menge, kamen beide durch,
 * und aus zehn bestellten Rollen wurden zwanzig gelieferte – mit zwei
 * Lagerbewegungen und einem Bestand, der nicht mehr stimmt.
 *
 * Zweiter Fall in derselben Rechnung: Nennt eine Meldung dieselbe Position
 * mehrfach, muss die Summe zählen. Einzeln geprüft kämen zweimal sechs von
 * zehn offenen Stück beide durch.
 */
const prismaMock = {
  purchaseOrder: { findUnique: jest.fn(), update: jest.fn() },
  purchaseOrderItem: { update: jest.fn(), findMany: jest.fn() },
  article: { update: jest.fn() },
  stockMovement: { create: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

jest.mock('@/server/prisma', () => ({ prisma: prismaMock }));

process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

import { purchasingService } from '@/server/dienste/inventory/purchasing.service';

const dezimal = (wert: number) => new Prisma.Decimal(wert);

function bestellung(geliefert = 0) {
  return {
    id: 'bestellung-1',
    orderNumber: 'BE-2026-0001',
    status: PurchaseOrderStatus.BESTELLT,
    items: [
      {
        id: 'pos-1',
        title: 'Laufrolle Kugellager',
        unit: 'Stk',
        quantity: dezimal(10),
        deliveredQuantity: dezimal(geliefert),
        articleId: 'artikel-1',
        article: { id: 'artikel-1', stockManaged: true },
      },
    ],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.$queryRaw.mockResolvedValue([{ id: 'bestellung-1' }]);
  prismaMock.purchaseOrder.findUnique.mockResolvedValue(bestellung());
  prismaMock.purchaseOrderItem.update.mockResolvedValue({});
  prismaMock.purchaseOrderItem.findMany.mockResolvedValue([
    { quantity: dezimal(10), deliveredQuantity: dezimal(10) },
  ]);
  prismaMock.article.update.mockResolvedValue({ id: 'artikel-1', stock: dezimal(17) });
  prismaMock.stockMovement.create.mockResolvedValue({});
  prismaMock.purchaseOrder.update.mockResolvedValue({ id: 'bestellung-1' });
  prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));
});

describe('Wareneingang', () => {
  it('bucht eine offene Menge und schreibt eine Lagerbewegung', async () => {
    await purchasingService.receiveDelivery('bestellung-1', {
      items: [{ itemId: 'pos-1', quantity: 10 }],
    } as never);

    expect(prismaMock.purchaseOrderItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deliveredQuantity: { increment: 10 } } }),
    );
    expect(prismaMock.stockMovement.create).toHaveBeenCalledTimes(1);
  });

  it('sperrt die Bestellung, bevor es den offenen Stand liest', async () => {
    await purchasingService.receiveDelivery('bestellung-1', {
      items: [{ itemId: 'pos-1', quantity: 1 }],
    } as never);

    const [vorlage] = prismaMock.$queryRaw.mock.calls[0] as [string[]];
    expect(vorlage.join('?')).toContain('FOR UPDATE');
    // Erst sperren, dann lesen – die andere Reihenfolge schützt nicht.
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.purchaseOrder.findUnique.mock.invocationCallOrder[0],
    );
  });

  it('weist mehr zurück, als noch offen ist', async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue(bestellung(10));

    await expect(
      purchasingService.receiveDelivery('bestellung-1', {
        items: [{ itemId: 'pos-1', quantity: 10 }],
      } as never),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Für "Laufrolle Kugellager" sind nur noch 0 Stk offen.',
    });
    expect(prismaMock.purchaseOrderItem.update).not.toHaveBeenCalled();
  });

  it('zählt dieselbe Position innerhalb einer Meldung zusammen', async () => {
    await expect(
      purchasingService.receiveDelivery('bestellung-1', {
        items: [
          { itemId: 'pos-1', quantity: 6 },
          { itemId: 'pos-1', quantity: 6 },
        ],
      } as never),
    ).rejects.toMatchObject({ status: 400 });
    // Nichts gebucht: Die Prüfung liegt vor jeder Änderung.
    expect(prismaMock.purchaseOrderItem.update).not.toHaveBeenCalled();
    expect(prismaMock.article.update).not.toHaveBeenCalled();
  });

  it('lässt zwei Teilmengen derselben Position durch, solange die Summe passt', async () => {
    await purchasingService.receiveDelivery('bestellung-1', {
      items: [
        { itemId: 'pos-1', quantity: 4 },
        { itemId: 'pos-1', quantity: 4 },
      ],
    } as never);

    expect(prismaMock.purchaseOrderItem.update).toHaveBeenCalledTimes(2);
  });

  it('bucht nichts auf eine stornierte Bestellung', async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      ...bestellung(),
      status: PurchaseOrderStatus.STORNIERT,
    });

    await expect(
      purchasingService.receiveDelivery('bestellung-1', {
        items: [{ itemId: 'pos-1', quantity: 1 }],
      } as never),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('weist eine fremde Bestellposition ab', async () => {
    await expect(
      purchasingService.receiveDelivery('bestellung-1', {
        items: [{ itemId: 'pos-fremd', quantity: 1 }],
      } as never),
    ).rejects.toMatchObject({ status: 400 });
  });
});
