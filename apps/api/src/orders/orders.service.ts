import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { addDays, round, type Paginated } from '@garagentor/shared';
import { InvoiceType, OrderStatus, Prisma } from '@prisma/client';
import { prepareLineItems, withoutOptionalFlag } from '../common/dto/line-item.dto';
import { orderBy, paginate } from '../common/dto/pagination.dto';
import { NumberRangeService } from '../common/numbering/number-range.service';
import { CustomersService } from '../customers/customers.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateInvoiceFromOrderDto,
  CreateOrderDto,
  OrderQueryDto,
  UpdateOrderDto,
} from './dto/order.dto';

const SORTABLE = ['orderNumber', 'plannedStart', 'grossTotal', 'status', 'createdAt'] as const;

const CLOSED_STATUSES: OrderStatus[] = [
  OrderStatus.ABGESCHLOSSEN,
  OrderStatus.ABGERECHNET,
  OrderStatus.STORNIERT,
];

/** Erlaubte Statuswechsel eines Auftrags. */
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  ANGELEGT: [OrderStatus.EINGEPLANT, OrderStatus.IN_ARBEIT, OrderStatus.STORNIERT],
  EINGEPLANT: [OrderStatus.IN_ARBEIT, OrderStatus.ANGELEGT, OrderStatus.STORNIERT],
  IN_ARBEIT: [
    OrderStatus.WARTET_AUF_MATERIAL,
    OrderStatus.ABGESCHLOSSEN,
    OrderStatus.EINGEPLANT,
    OrderStatus.STORNIERT,
  ],
  WARTET_AUF_MATERIAL: [OrderStatus.IN_ARBEIT, OrderStatus.STORNIERT],
  ABGESCHLOSSEN: [OrderStatus.ABGERECHNET, OrderStatus.IN_ARBEIT],
  ABGERECHNET: [],
  STORNIERT: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: NumberRangeService,
    private readonly customers: CustomersService,
  ) {}

  async findAll(query: OrderQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.open ? { status: { notIn: CLOSED_STATUSES } } : {}),
      ...(query.search
        ? {
            OR: [
              { orderNumber: { contains: query.search, mode: 'insensitive' } },
              { subject: { contains: query.search, mode: 'insensitive' } },
              { customerReference: { contains: query.search, mode: 'insensitive' } },
              { customer: { companyName: { contains: query.search, mode: 'insensitive' } } },
              { customer: { lastName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              customerNumber: true,
              companyName: true,
              firstName: true,
              lastName: true,
            },
          },
          site: { select: { id: true, name: true, city: true } },
          _count: { select: { invoices: true, appointments: true, serviceReports: true } },
        },
        orderBy: orderBy(query, SORTABLE, { createdAt: 'desc' }),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: { include: { addresses: true } },
        site: true,
        quote: { select: { id: true, quoteNumber: true } },
        project: { select: { id: true, projectNumber: true, name: true } },
        items: { orderBy: { position: 'asc' } },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            type: true,
            status: true,
            grossTotal: true,
            date: true,
          },
        },
        appointments: { orderBy: { start: 'asc' } },
        serviceReports: { select: { id: true, reportNumber: true, date: true, status: true } },
        inspections: { select: { id: true, inspectionNumber: true, date: true, result: true } },
      },
    });
    if (!order) {
      throw new NotFoundException('Der Auftrag wurde nicht gefunden.');
    }
    return order;
  }

  /** Gegenüberstellung von erfassten Zeiten und Auftragswert. */
  async costs(id: string) {
    await this.assertExists(id);

    const [times, materials, invoiced] = await this.prisma.$transaction([
      this.prisma.timeEntry.groupBy({
        by: ['type'],
        where: { orderId: id },
        _sum: { hours: true },
        orderBy: { type: 'asc' },
      }),
      this.prisma.stockMovement.findMany({
        where: { orderId: id },
        include: { article: { select: { name: true, purchasePrice: true, salesPrice: true } } },
      }),
      this.prisma.invoice.aggregate({
        where: { orderId: id, status: { not: 'STORNIERT' } },
        _sum: { netTotal: true },
      }),
    ]);

    const hours = times.reduce((sum, row) => sum + (row._sum?.hours?.toNumber() ?? 0), 0);
    const materialCost = materials.reduce(
      (sum, movement) =>
        sum + movement.quantity.toNumber() * (movement.article.purchasePrice.toNumber() ?? 0),
      0,
    );

    return {
      stunden: round(hours),
      stundenNachArt: times.map((row) => ({
        typ: row.type,
        stunden: round(row._sum?.hours?.toNumber() ?? 0),
      })),
      materialEinkauf: round(materialCost),
      abgerechnetNetto: round(invoiced._sum.netTotal?.toNumber() ?? 0),
    };
  }

  async create(dto: CreateOrderDto) {
    await this.customers.assertExists(dto.customerId);
    if (dto.siteId) {
      await this.customers.assertSiteBelongsToCustomer(dto.siteId, dto.customerId);
    }

    const { prepared, totals } = prepareLineItems(dto.items ?? [], dto.discountPercent ?? 0);

    return this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.numbers.next('ORDER', tx);
      return tx.order.create({
        data: {
          orderNumber,
          customerId: dto.customerId,
          siteId: dto.siteId ?? null,
          projectId: dto.projectId ?? null,
          type: dto.type ?? 'MONTAGE',
          status: dto.plannedStart ? OrderStatus.EINGEPLANT : OrderStatus.ANGELEGT,
          subject: dto.subject,
          description: dto.description ?? null,
          customerReference: dto.customerReference ?? null,
          plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : null,
          plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : null,
          discountPercent: dto.discountPercent ?? 0,
          notes: dto.notes ?? null,
          netTotal: totals.netAmount,
          vatTotal: totals.vatAmount,
          grossTotal: totals.grossAmount,
          items: { create: prepared.map(withoutOptionalFlag) },
        },
        include: { items: { orderBy: { position: 'asc' } }, customer: true },
      });
    });
  }

  async update(id: string, dto: UpdateOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Der Auftrag wurde nicht gefunden.');
    }
    if (order.status === OrderStatus.ABGERECHNET || order.status === OrderStatus.STORNIERT) {
      throw new ConflictException(
        'Abgerechnete oder stornierte Aufträge können nicht mehr geändert werden.',
      );
    }
    if (dto.siteId) {
      await this.customers.assertSiteBelongsToCustomer(
        dto.siteId,
        dto.customerId ?? order.customerId,
      );
    }

    const discountPercent = dto.discountPercent ?? order.discountPercent.toNumber();

    return this.prisma.$transaction(async (tx) => {
      let totals: { netAmount: number; vatAmount: number; grossAmount: number };

      if (dto.items) {
        const invoiced = await tx.orderItem.findFirst({
          where: { orderId: id, invoicedQuantity: { gt: 0 } },
        });
        if (invoiced) {
          throw new ConflictException(
            'Positionen können nicht ersetzt werden, weil bereits Teile abgerechnet wurden.',
          );
        }

        const prepared = prepareLineItems(dto.items, discountPercent);
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await tx.orderItem.createMany({
          data: prepared.prepared.map((item) => ({ ...withoutOptionalFlag(item), orderId: id })),
        });
        totals = prepared.totals;
      } else {
        const items = await tx.orderItem.findMany({ where: { orderId: id } });
        totals = prepareLineItems(
          items.map((item) => ({
            type: item.type,
            title: item.title,
            quantity: item.quantity.toNumber(),
            unit: item.unit,
            unitPrice: item.unitPrice.toNumber(),
            discountPercent: item.discountPercent.toNumber(),
            vatRate: item.vatRate.toNumber(),
          })),
          discountPercent,
        ).totals;
      }

      return tx.order.update({
        where: { id },
        data: {
          ...(dto.siteId === undefined ? {} : { siteId: dto.siteId }),
          ...(dto.projectId === undefined ? {} : { projectId: dto.projectId }),
          ...(dto.type === undefined ? {} : { type: dto.type }),
          ...(dto.subject === undefined ? {} : { subject: dto.subject }),
          ...(dto.description === undefined ? {} : { description: dto.description }),
          ...(dto.customerReference === undefined
            ? {}
            : { customerReference: dto.customerReference }),
          ...(dto.plannedStart === undefined
            ? {}
            : { plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : null }),
          ...(dto.plannedEnd === undefined
            ? {}
            : { plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : null }),
          ...(dto.notes === undefined ? {} : { notes: dto.notes }),
          discountPercent,
          netTotal: totals.netAmount,
          vatTotal: totals.vatAmount,
          grossTotal: totals.grossAmount,
        },
        include: { items: { orderBy: { position: 'asc' } }, customer: true },
      });
    });
  }

  /** Führt einen Statuswechsel entlang der erlaubten Übergänge aus. */
  async changeStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Der Auftrag wurde nicht gefunden.');
    }
    if (order.status === status) return order;

    if (!STATUS_TRANSITIONS[order.status].includes(status)) {
      throw new ConflictException(
        `Der Wechsel von "${order.status}" nach "${status}" ist nicht vorgesehen.`,
      );
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        status,
        ...(status === OrderStatus.IN_ARBEIT && !order.startedAt ? { startedAt: new Date() } : {}),
        ...(status === OrderStatus.ABGESCHLOSSEN ? { completedAt: new Date() } : {}),
      },
    });
  }

  /**
   * Erzeugt aus dem Auftrag eine Rechnung. Bei einer Abschlagsrechnung wird
   * eine anteilige Sammelposition gebildet; die Schlussrechnung zieht die
   * bereits gestellten Abschläge ab.
   */
  async createInvoice(id: string, dto: CreateInvoiceFromOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { orderBy: { position: 'asc' } }, customer: true },
    });
    if (!order) {
      throw new NotFoundException('Der Auftrag wurde nicht gefunden.');
    }
    if (order.status === OrderStatus.STORNIERT) {
      throw new ConflictException(
        'Zu einem stornierten Auftrag kann keine Rechnung erstellt werden.',
      );
    }
    if (order.items.length === 0) {
      throw new BadRequestException('Der Auftrag enthält keine Positionen.');
    }

    const type =
      dto.type ?? (dto.partialPercent ? InvoiceType.ABSCHLAGSRECHNUNG : InvoiceType.RECHNUNG);
    const date = dto.date ? new Date(dto.date) : new Date();
    const dueDate = addDays(date, order.customer.paymentTermsDays);

    const items = dto.partialPercent
      ? [
          {
            type: 'LEISTUNG' as const,
            title: `Abschlag ${dto.partialPercent} % zu Auftrag ${order.orderNumber}`,
            description: order.subject,
            quantity: 1,
            unit: 'Pau',
            // Der Abschlag bezieht sich auf die Nettosumme des Auftrags.
            unitPrice: round(order.netTotal.toNumber() * (dto.partialPercent / 100)),
            discountPercent: 0,
            // Für den Abschlag wird der überwiegende Steuersatz des Auftrags verwendet.
            vatRate: this.dominantVatRate(order.items),
          },
        ]
      : order.items.map((item) => ({
          type: item.type,
          articleId: item.articleId ?? undefined,
          title: item.title,
          description: item.description ?? undefined,
          quantity: item.quantity.toNumber(),
          unit: item.unit,
          unitPrice: item.unitPrice.toNumber(),
          discountPercent: item.discountPercent.toNumber(),
          vatRate: item.vatRate.toNumber(),
        }));

    const { prepared, totals } = prepareLineItems(
      items,
      dto.partialPercent ? 0 : order.discountPercent.toNumber(),
    );

    // Bei einer Schlussrechnung werden bereits gestellte Abschläge verrechnet.
    const deducted =
      type === InvoiceType.SCHLUSSRECHNUNG
        ? await this.prisma.invoice.aggregate({
            where: {
              orderId: id,
              type: InvoiceType.ABSCHLAGSRECHNUNG,
              status: { not: 'STORNIERT' },
            },
            _sum: { grossTotal: true },
          })
        : null;
    const deductedAmount = round(deducted?._sum.grossTotal?.toNumber() ?? 0);

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.numbers.next('INVOICE', tx);

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          type,
          customerId: order.customerId,
          orderId: order.id,
          date,
          dueDate,
          serviceDate: dto.serviceDate ? new Date(dto.serviceDate) : order.completedAt,
          subject: order.subject,
          introText: dto.introText ?? null,
          outroText: dto.outroText ?? null,
          discountPercent: dto.partialPercent ? 0 : order.discountPercent,
          netTotal: totals.netAmount,
          vatTotal: totals.vatAmount,
          grossTotal: totals.grossAmount,
          deductedAmount,
          items: { create: prepared.map(withoutOptionalFlag) },
        },
        include: { items: { orderBy: { position: 'asc' } }, customer: true },
      });

      // Vollständige Abrechnung schließt den Auftrag ab und markiert alle
      // Positionen als abgerechnet. Prisma kann in updateMany nicht auf die
      // eigene Spalte verweisen, daher als SQL-Anweisung.
      if (!dto.partialPercent) {
        await tx.$executeRaw`
          UPDATE order_items SET "invoicedQuantity" = quantity WHERE "orderId" = ${id}
        `;
        if (order.status === OrderStatus.ABGESCHLOSSEN) {
          await tx.order.update({ where: { id }, data: { status: OrderStatus.ABGERECHNET } });
        }
      }

      return invoice;
    });
  }

  async remove(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { _count: { select: { invoices: true } } },
    });
    if (!order) {
      throw new NotFoundException('Der Auftrag wurde nicht gefunden.');
    }
    if (order._count.invoices > 0) {
      throw new ConflictException(
        'Zum Auftrag existieren Rechnungen. Er kann nur storniert werden.',
      );
    }
    if (order.status !== OrderStatus.ANGELEGT) {
      return this.prisma.order.update({ where: { id }, data: { status: OrderStatus.STORNIERT } });
    }

    await this.prisma.order.delete({ where: { id } });
    return { deleted: true, id };
  }

  async assertExists(id: string): Promise<void> {
    const count = await this.prisma.order.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException('Der Auftrag wurde nicht gefunden.');
    }
  }

  /** Steuersatz mit dem größten Nettoanteil im Auftrag. */
  private dominantVatRate(
    items: Array<{ vatRate: Prisma.Decimal; netAmount: Prisma.Decimal }>,
  ): number {
    const byRate = new Map<number, number>();
    for (const item of items) {
      const rate = item.vatRate.toNumber();
      byRate.set(rate, (byRate.get(rate) ?? 0) + item.netAmount.toNumber());
    }

    let dominant = 19;
    let max = -Infinity;
    for (const [rate, net] of byRate) {
      if (net > max) {
        max = net;
        dominant = rate;
      }
    }
    return dominant;
  }
}
