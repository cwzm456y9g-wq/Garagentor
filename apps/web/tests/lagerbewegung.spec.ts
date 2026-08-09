import { Prisma, ServiceReportStatus, StockMovementType } from '@prisma/client';

/**
 * Der Lagerbestand darf nicht davon abhängen, wer zuerst fertig ist.
 *
 * Beide Wege hierher rechneten aus einem Stand, den sie außerhalb der
 * Transaktion gelesen hatten:
 *
 * - Eine Lagerbewegung schreibt den neuen Bestand als festen Wert – eine
 *   Inventur ersetzt ihn ja, sie zählt nicht dazu. Zwei gleichzeitige
 *   Bewegungen gingen beide vom selben Bestand aus, die zweite überschrieb die
 *   erste. Auch die Prüfung auf negativen Bestand rechnete mit einem
 *   überholten Wert.
 *
 * - Der Abschluss eines Serviceberichts bucht Material aus. Lag die Prüfung
 *   „ist noch Entwurf" davor, kamen zwei gleichzeitige Abschlüsse beide durch
 *   und zogen das Material zweimal ab – ein Doppelklick auf dem Tablet des
 *   Monteurs genügt.
 */
const prismaMock = {
  article: { findUnique: jest.fn(), update: jest.fn() },
  stockMovement: { create: jest.fn() },
  serviceReport: { findUnique: jest.fn(), update: jest.fn() },
  serviceReportMaterial: { findMany: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

jest.mock('@/server/prisma', () => ({ prisma: prismaMock }));

process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

import { articles } from '@/server/dienste/inventory/articles.service';
import { serviceReportsService } from '@/server/dienste/doors/service-reports.service';

const dezimal = (wert: number) => new Prisma.Decimal(wert);

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.$queryRaw.mockResolvedValue([{ id: 'x' }]);
  prismaMock.article.findUnique.mockResolvedValue({
    id: 'artikel-1',
    unit: 'Stk',
    stockManaged: true,
    stock: dezimal(100),
  });
  prismaMock.article.update.mockResolvedValue({ id: 'artikel-1', stock: dezimal(95) });
  prismaMock.stockMovement.create.mockResolvedValue({ id: 'bewegung-1' });
  prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));
});

describe('Lagerbewegung', () => {
  it('sperrt den Artikel, bevor es den Bestand liest', async () => {
    await articles.recordMovement('artikel-1', {
      type: StockMovementType.ABGANG,
      quantity: 5,
    } as never);

    const [vorlage] = prismaMock.$queryRaw.mock.calls[0] as [string[]];
    expect(vorlage.join('?')).toContain('FOR UPDATE');
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.article.findUnique.mock.invocationCallOrder[0],
    );
  });

  it('schreibt den neuen Bestand und protokolliert ihn', async () => {
    await articles.recordMovement('artikel-1', {
      type: StockMovementType.ABGANG,
      quantity: 5,
    } as never);

    expect(prismaMock.article.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stock: 95 } }),
    );
    expect(prismaMock.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stockAfter: 95 }) }),
    );
  });

  it('lässt den Bestand nicht negativ werden', async () => {
    await expect(
      articles.recordMovement('artikel-1', {
        type: StockMovementType.ABGANG,
        quantity: 150,
      } as never),
    ).rejects.toMatchObject({ status: 400 });
    expect(prismaMock.article.update).not.toHaveBeenCalled();
  });

  it('ersetzt den Bestand bei einer Inventur, statt zu verrechnen', async () => {
    await articles.recordMovement('artikel-1', {
      type: StockMovementType.INVENTUR,
      quantity: 87,
    } as never);

    expect(prismaMock.article.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stock: 87 } }),
    );
    // Protokolliert wird die Differenz zum Vorbestand, nicht die gezählte Menge.
    expect(prismaMock.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 13 }) }),
    );
  });

  it('bewegt nichts bei einem Artikel ohne Bestandsführung', async () => {
    prismaMock.article.findUnique.mockResolvedValue({
      id: 'artikel-1',
      unit: 'Stk',
      stockManaged: false,
      stock: dezimal(0),
    });

    await expect(
      articles.recordMovement('artikel-1', {
        type: StockMovementType.ABGANG,
        quantity: 1,
      } as never),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('Servicebericht abschließen', () => {
  beforeEach(() => {
    prismaMock.serviceReport.findUnique.mockResolvedValue({
      id: 'bericht-1',
      reportNumber: 'SB-2026-0003',
      status: ServiceReportStatus.ENTWURF,
      orderId: null,
    });
    prismaMock.serviceReport.update.mockResolvedValue({ id: 'bericht-1' });
    prismaMock.serviceReportMaterial.findMany.mockResolvedValue([
      {
        articleId: 'artikel-1',
        quantity: dezimal(5),
        article: { id: 'artikel-1', stockManaged: true },
      },
    ]);
  });

  it('sperrt den Bericht, bevor es den Status prüft', async () => {
    await serviceReportsService.complete('bericht-1', {} as never);

    const [vorlage] = prismaMock.$queryRaw.mock.calls[0] as [string[]];
    expect(vorlage.join('?')).toContain('FOR UPDATE');
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.serviceReport.findUnique.mock.invocationCallOrder[0],
    );
  });

  it('bucht das Material genau einmal aus', async () => {
    await serviceReportsService.complete('bericht-1', {} as never);

    expect(prismaMock.article.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.article.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stock: { decrement: 5 } } }),
    );
  });

  it('bucht nichts, wenn der Bericht schon abgeschlossen ist', async () => {
    prismaMock.serviceReport.findUnique.mockResolvedValue({
      id: 'bericht-1',
      status: ServiceReportStatus.ABGESCHLOSSEN,
      orderId: null,
    });

    await expect(serviceReportsService.complete('bericht-1', {} as never)).rejects.toMatchObject({
      status: 409,
    });
    expect(prismaMock.article.update).not.toHaveBeenCalled();
  });

  it('lässt den Bestand auf Wunsch unberührt', async () => {
    await serviceReportsService.complete('bericht-1', { deductStock: false } as never);

    expect(prismaMock.article.update).not.toHaveBeenCalled();
    expect(prismaMock.serviceReport.update).toHaveBeenCalled();
  });
});
