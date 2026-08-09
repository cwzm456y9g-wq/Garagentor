import { prisma } from '@/server/prisma';
import { numbers } from '../common/numbering/number-range.service';
import { BadRequestException, ConflictException, NotFoundException } from '@/server/nest-ersatz';
import { calculateDocumentTotals, round, type Paginated } from '@garagentor/shared';
import { Prisma, PurchaseOrderStatus, StockMovementType } from '@prisma/client';
import { orderBy, paginate } from '@/server/anfrage';

import type {
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  PurchaseOrderItemDto,
  PurchaseOrderQueryDto,
  ReceiveDeliveryDto,
  ReorderSuggestionQueryDto,
  UpdatePurchaseOrderDto,
  UpdateSupplierDto,
} from './dto/inventory.dto';
import { type PaginationQueryDto } from '@/server/anfrage';

const SUPPLIER_SORTABLE = ['supplierNumber', 'name', 'createdAt'] as const;

export class PurchasingService {
  /* Lieferanten -------------------------------------------------------- */

  async findSuppliers(query: PaginationQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.SupplierWhereInput = query.search
      ? {
          OR: [
            { supplierNumber: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
            { contactName: { contains: query.search, mode: 'insensitive' } },
            { city: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await prisma.$transaction([
      prisma.supplier.findMany({
        where,
        include: { _count: { select: { articles: true, purchaseOrders: true } } },
        orderBy: orderBy(query, SUPPLIER_SORTABLE, { name: 'asc' }),
        skip: query.skip,
        take: query.take,
      }),
      prisma.supplier.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findSupplier(id: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        articles: {
          where: { active: true },
          select: { id: true, articleNumber: true, name: true, stock: true, minStock: true },
          orderBy: { name: 'asc' },
        },
        purchaseOrders: {
          orderBy: { date: 'desc' },
          take: 10,
          select: { id: true, orderNumber: true, date: true, status: true, grossTotal: true },
        },
      },
    });
    if (!supplier) {
      throw new NotFoundException('Der Lieferant wurde nicht gefunden.');
    }
    return supplier;
  }

  async createSupplier(dto: CreateSupplierDto) {
    return prisma.$transaction(async (tx) => {
      const supplierNumber = await numbers.next('SUPPLIER', tx);
      return tx.supplier.create({ data: { ...dto, supplierNumber } });
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      throw new NotFoundException('Der Lieferant wurde nicht gefunden.');
    }
    return prisma.supplier.update({ where: { id }, data: dto });
  }

  async removeSupplier(id: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { articles: true, purchaseOrders: true } } },
    });
    if (!supplier) {
      throw new NotFoundException('Der Lieferant wurde nicht gefunden.');
    }

    if (supplier._count.articles > 0 || supplier._count.purchaseOrders > 0) {
      return prisma.supplier.update({ where: { id }, data: { active: false } });
    }

    await prisma.supplier.delete({ where: { id } });
    return { deleted: true, id };
  }

  /* Bestellungen ------------------------------------------------------- */

  async findOrders(query: PurchaseOrderQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.PurchaseOrderWhereInput = {
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { orderNumber: { contains: query.search, mode: 'insensitive' } },
              { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, supplierNumber: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { date: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOrder(id: string) {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          orderBy: { position: 'asc' },
          include: { article: { select: { id: true, articleNumber: true, stock: true } } },
        },
        stockMovements: {
          include: { article: { select: { articleNumber: true, name: true } } },
          orderBy: { date: 'desc' },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Die Bestellung wurde nicht gefunden.');
    }
    return order;
  }

  async createOrder(dto: CreatePurchaseOrderDto) {
    const supplier = await prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier) {
      throw new NotFoundException('Der Lieferant wurde nicht gefunden.');
    }

    const { prepared, totals } = this.prepareItems(dto.items);

    return prisma.$transaction(async (tx) => {
      const orderNumber = await numbers.next('PURCHASE_ORDER', tx);
      return tx.purchaseOrder.create({
        data: {
          orderNumber,
          supplierId: dto.supplierId,
          expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : null,
          notes: dto.notes ?? null,
          netTotal: totals.netAmount,
          vatTotal: totals.vatAmount,
          grossTotal: totals.grossAmount,
          items: { create: prepared },
        },
        include: { items: { orderBy: { position: 'asc' } }, supplier: true },
      });
    });
  }

  async updateOrder(id: string, dto: UpdatePurchaseOrderDto) {
    const order = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Die Bestellung wurde nicht gefunden.');
    }
    if (order.status !== PurchaseOrderStatus.ENTWURF) {
      throw new ConflictException('Nur Bestellungen im Entwurf können geändert werden.');
    }

    return prisma.$transaction(async (tx) => {
      let totals = {
        netAmount: order.netTotal.toNumber(),
        vatAmount: order.vatTotal.toNumber(),
        grossAmount: order.grossTotal.toNumber(),
      };

      if (dto.items) {
        const prepared = this.prepareItems(dto.items);
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
        await tx.purchaseOrderItem.createMany({
          data: prepared.prepared.map((item) => ({ ...item, purchaseOrderId: id })),
        });
        totals = prepared.totals;
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(dto.supplierId === undefined ? {} : { supplierId: dto.supplierId }),
          ...(dto.expectedAt === undefined
            ? {}
            : { expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : null }),
          ...(dto.notes === undefined ? {} : { notes: dto.notes }),
          netTotal: totals.netAmount,
          vatTotal: totals.vatAmount,
          grossTotal: totals.grossAmount,
        },
        include: { items: { orderBy: { position: 'asc' } }, supplier: true },
      });
    });
  }

  /** Gibt die Bestellung beim Lieferanten auf. */
  async submitOrder(id: string) {
    const order = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Die Bestellung wurde nicht gefunden.');
    }
    if (order.status !== PurchaseOrderStatus.ENTWURF) {
      throw new ConflictException('Die Bestellung wurde bereits aufgegeben.');
    }

    return prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.BESTELLT, date: new Date() },
      include: { items: { orderBy: { position: 'asc' } }, supplier: true },
    });
  }

  /**
   * Bucht einen Wareneingang. Teillieferungen sind möglich; der Bestellstatus
   * ergibt sich aus den insgesamt gelieferten Mengen. Bestandsgeführte Artikel
   * erhalten je Position eine Lagerbewegung.
   */
  async receiveDelivery(id: string, dto: ReceiveDeliveryDto, userId?: string) {
    const date = dto.date ? new Date(dto.date) : new Date();

    return prisma.$transaction(async (tx) => {
      // Die Bestellzeile bis zum Ende der Transaktion sperren und erst danach
      // lesen und prüfen.
      //
      // Vorher stand die Prüfung davor: Was noch offen ist, wurde aus einem
      // Stand gelesen, den ein zweiter Aufruf längst überholt haben konnte.
      // Zwei gleichzeitige Wareneingänge sahen dann beide dieselbe offene
      // Menge, kamen beide durch, und aus zehn bestellten Rollen wurden zwanzig
      // gelieferte – mit zwei Lagerbewegungen und einem Bestand, der nicht mehr
      // stimmt. Nachgestellt und nachgemessen: 7 Stück vor, 27 danach.
      await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${id} FOR UPDATE`;

      const order = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: { include: { article: true } } },
      });
      if (!order) {
        throw new NotFoundException('Die Bestellung wurde nicht gefunden.');
      }
      if (order.status === PurchaseOrderStatus.ENTWURF) {
        throw new ConflictException('Die Bestellung wurde noch nicht aufgegeben.');
      }
      if (order.status === PurchaseOrderStatus.STORNIERT) {
        throw new ConflictException('Die Bestellung ist storniert.');
      }

      const byId = new Map(order.items.map((item) => [item.id, item]));

      // Nennt die Meldung dieselbe Position mehrfach, zählt die Summe. Einzeln
      // geprüft kämen zweimal sechs von zehn offenen Stück beide durch.
      const jePosition = new Map<string, number>();
      for (const receipt of dto.items) {
        if (!byId.has(receipt.itemId)) {
          throw new BadRequestException(
            `Die Bestellposition ${receipt.itemId} gehört nicht zur Bestellung.`,
          );
        }
        jePosition.set(receipt.itemId, (jePosition.get(receipt.itemId) ?? 0) + receipt.quantity);
      }

      for (const [itemId, menge] of jePosition) {
        const item = byId.get(itemId)!;
        const open = item.quantity.toNumber() - item.deliveredQuantity.toNumber();
        if (menge > open + 0.001) {
          throw new BadRequestException(
            `Für "${item.title}" sind nur noch ${round(open, 3)} ${item.unit} offen.`,
          );
        }
      }

      for (const receipt of dto.items) {
        const item = byId.get(receipt.itemId)!;

        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { deliveredQuantity: { increment: receipt.quantity } },
        });

        if (item.articleId && item.article?.stockManaged) {
          const article = await tx.article.update({
            where: { id: item.articleId },
            data: { stock: { increment: receipt.quantity } },
          });

          await tx.stockMovement.create({
            data: {
              articleId: item.articleId,
              type: StockMovementType.ZUGANG,
              quantity: receipt.quantity,
              stockAfter: article.stock,
              purchaseOrderId: id,
              userId: userId ?? null,
              date,
              reference: dto.reference ?? order.orderNumber,
              note: 'Wareneingang zur Bestellung',
            },
          });
        }
      }

      // Status aus den insgesamt gelieferten Mengen ableiten.
      const items = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: id } });
      const complete = items.every(
        (item) => item.deliveredQuantity.toNumber() >= item.quantity.toNumber() - 0.001,
      );

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          status: complete ? PurchaseOrderStatus.GELIEFERT : PurchaseOrderStatus.TEILGELIEFERT,
          deliveredAt: complete ? date : null,
        },
        include: { items: { orderBy: { position: 'asc' } }, supplier: true },
      });
    });
  }

  async cancelOrder(id: string) {
    const order = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Die Bestellung wurde nicht gefunden.');
    }
    if (order.status === PurchaseOrderStatus.GELIEFERT) {
      throw new ConflictException(
        'Eine vollständig gelieferte Bestellung kann nicht storniert werden.',
      );
    }

    return prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.STORNIERT },
    });
  }

  async removeOrder(id: string) {
    const order = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Die Bestellung wurde nicht gefunden.');
    }
    if (order.status !== PurchaseOrderStatus.ENTWURF) {
      return this.cancelOrder(id);
    }

    await prisma.purchaseOrder.delete({ where: { id } });
    return { deleted: true, id };
  }

  /**
   * Bestellvorschlag: alle Artikel unter dem Meldebestand, gruppiert nach
   * Lieferant. Bestellt wird die Differenz zum Meldebestand.
   */
  async reorderSuggestions(query: ReorderSuggestionQueryDto) {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        articleNumber: string;
        name: string;
        unit: string;
        stock: Prisma.Decimal;
        minStock: Prisma.Decimal;
        purchasePrice: Prisma.Decimal;
        supplierId: string | null;
        supplierName: string | null;
      }>
    >(
      Prisma.sql`
        SELECT a.id, a."articleNumber", a.name, a.unit, a.stock, a."minStock",
               a."purchasePrice", a."supplierId", s.name AS "supplierName"
        FROM articles a
        LEFT JOIN suppliers s ON s.id = a."supplierId"
        WHERE a."stockManaged" = true AND a.active = true AND a.stock < a."minStock"
          ${query.supplierId ? Prisma.sql`AND a."supplierId" = ${query.supplierId}` : Prisma.empty}
        ORDER BY s.name NULLS LAST, a.name
      `,
    );

    const grouped = new Map<
      string,
      { supplierId: string | null; supplierName: string; positionen: unknown[]; summe: number }
    >();

    for (const row of rows) {
      const key = row.supplierId ?? 'ohne';
      const quantity = round(row.minStock.toNumber() - row.stock.toNumber(), 3);
      const total = round(quantity * row.purchasePrice.toNumber());

      const group = grouped.get(key) ?? {
        supplierId: row.supplierId,
        supplierName: row.supplierName ?? 'Ohne Lieferant',
        positionen: [],
        summe: 0,
      };

      group.positionen.push({
        articleId: row.id,
        articleNumber: row.articleNumber,
        name: row.name,
        unit: row.unit,
        stock: row.stock.toNumber(),
        minStock: row.minStock.toNumber(),
        vorschlagsmenge: quantity,
        einzelpreis: row.purchasePrice.toNumber(),
        summe: total,
      });
      group.summe = round(group.summe + total);
      grouped.set(key, group);
    }

    return [...grouped.values()];
  }

  /** Positionen nummerieren und Bestellsummen berechnen. */
  private prepareItems(items: PurchaseOrderItemDto[]) {
    const prepared = items.map((item, index) => {
      const netAmount = round(item.quantity * (item.unitPrice ?? 0));
      return {
        position: index + 1,
        articleId: item.articleId ?? null,
        title: item.title,
        quantity: item.quantity,
        unit: item.unit ?? 'Stk',
        unitPrice: item.unitPrice ?? 0,
        vatRate: item.vatRate ?? 19,
        netAmount,
      };
    });

    const totals = calculateDocumentTotals(
      items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? 0,
        vatRate: item.vatRate ?? 19,
      })),
    );

    return { prepared, totals };
  }
}

export const purchasingService = new PurchasingService();
