import { prisma } from '@/server/prisma';
import { customers } from '../customers/customers.service';
import { numbers } from '../common/numbering/number-range.service';
import { BadRequestException, ConflictException, NotFoundException } from '@/server/nest-ersatz';
import { addDays, DEFAULT_QUOTE_VALIDITY_DAYS, type Paginated } from '@garagentor/shared';
import { OrderStatus, type Prisma, QuoteStatus } from '@prisma/client';
import { orderBy, paginate } from '@/server/anfrage';
import { prepareLineItems, withoutOptionalFlag } from '../common/dto/line-item.dto';

import type {
  ConvertQuoteDto,
  CreateQuoteDto,
  QuoteQueryDto,
  RejectQuoteDto,
  UpdateQuoteDto,
} from './dto/quote.dto';

const SORTABLE = ['quoteNumber', 'date', 'validUntil', 'grossTotal', 'status'] as const;

/** Nach dem Versand sind nur noch Status-, keine inhaltlichen Änderungen erlaubt. */
const EDITABLE_STATUSES: QuoteStatus[] = [QuoteStatus.ENTWURF];

export class QuotesService {
  async findAll(query: QuoteQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.QuoteWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { quoteNumber: { contains: query.search, mode: 'insensitive' } },
              { subject: { contains: query.search, mode: 'insensitive' } },
              { customer: { companyName: { contains: query.search, mode: 'insensitive' } } },
              { customer: { lastName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.quote.findMany({
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
          _count: { select: { items: true, orders: true } },
        },
        orderBy: orderBy(query, SORTABLE, { date: 'desc' }),
        skip: query.skip,
        take: query.take,
      }),
      prisma.quote.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        customer: { include: { addresses: true } },
        site: true,
        items: { orderBy: { position: 'asc' } },
        orders: { select: { id: true, orderNumber: true, status: true } },
      },
    });
    if (!quote) {
      throw new NotFoundException('Das Angebot wurde nicht gefunden.');
    }
    return quote;
  }

  async create(dto: CreateQuoteDto) {
    await customers.assertExists(dto.customerId);
    if (dto.siteId) {
      await customers.assertSiteBelongsToCustomer(dto.siteId, dto.customerId);
    }

    const date = dto.date ? new Date(dto.date) : new Date();
    const validUntil = dto.validUntil
      ? new Date(dto.validUntil)
      : addDays(date, DEFAULT_QUOTE_VALIDITY_DAYS);

    if (validUntil < date) {
      throw new BadRequestException(
        'Das Gültigkeitsdatum darf nicht vor dem Angebotsdatum liegen.',
      );
    }

    const { prepared, totals } = prepareLineItems(dto.items, dto.discountPercent ?? 0);

    return prisma.$transaction(async (tx) => {
      const quoteNumber = await numbers.next('QUOTE', tx);
      return tx.quote.create({
        data: {
          quoteNumber,
          customerId: dto.customerId,
          siteId: dto.siteId ?? null,
          subject: dto.subject,
          date,
          validUntil,
          introText: dto.introText ?? null,
          outroText: dto.outroText ?? null,
          notes: dto.notes ?? null,
          discountPercent: dto.discountPercent ?? 0,
          netTotal: totals.netAmount,
          vatTotal: totals.vatAmount,
          grossTotal: totals.grossAmount,
          items: { create: prepared },
        },
        include: { items: { orderBy: { position: 'asc' } }, customer: true },
      });
    });
  }

  async update(id: string, dto: UpdateQuoteDto) {
    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) {
      throw new NotFoundException('Das Angebot wurde nicht gefunden.');
    }
    if (!EDITABLE_STATUSES.includes(quote.status)) {
      throw new ConflictException(
        'Nur Angebote im Entwurf können geändert werden. Bitte ein neues Angebot erstellen.',
      );
    }

    if (dto.customerId) {
      await customers.assertExists(dto.customerId);
    }
    if (dto.siteId) {
      await customers.assertSiteBelongsToCustomer(dto.siteId, dto.customerId ?? quote.customerId);
    }

    const discountPercent = dto.discountPercent ?? quote.discountPercent.toNumber();

    return prisma.$transaction(async (tx) => {
      // Positionen werden immer vollständig ersetzt, damit die fortlaufende
      // Nummerierung und die Summen konsistent bleiben.
      if (dto.items) {
        const { prepared, totals } = prepareLineItems(dto.items, discountPercent);
        await tx.quoteItem.deleteMany({ where: { quoteId: id } });
        await tx.quoteItem.createMany({
          data: prepared.map((item) => ({ ...item, quoteId: id })),
        });

        return tx.quote.update({
          where: { id },
          data: {
            ...this.scalarFields(dto),
            discountPercent,
            netTotal: totals.netAmount,
            vatTotal: totals.vatAmount,
            grossTotal: totals.grossAmount,
          },
          include: { items: { orderBy: { position: 'asc' } }, customer: true },
        });
      }

      // Ohne neue Positionen kann sich durch den Gesamtrabatt die Summe ändern.
      const items = await tx.quoteItem.findMany({ where: { quoteId: id } });
      const { totals } = prepareLineItems(
        items
          .filter((item) => !item.optional)
          .map((item) => ({
            type: item.type,
            title: item.title,
            quantity: item.quantity.toNumber(),
            unit: item.unit,
            unitPrice: item.unitPrice.toNumber(),
            discountPercent: item.discountPercent.toNumber(),
            vatRate: item.vatRate.toNumber(),
          })),
        discountPercent,
      );

      return tx.quote.update({
        where: { id },
        data: {
          ...this.scalarFields(dto),
          discountPercent,
          netTotal: totals.netAmount,
          vatTotal: totals.vatAmount,
          grossTotal: totals.grossAmount,
        },
        include: { items: { orderBy: { position: 'asc' } }, customer: true },
      });
    });
  }

  /** Markiert das Angebot als versendet; danach ist es inhaltlich gesperrt. */
  async send(id: string) {
    const quote = await this.requireStatus(id, [QuoteStatus.ENTWURF]);

    const itemCount = await prisma.quoteItem.count({ where: { quoteId: quote.id } });
    if (itemCount === 0) {
      throw new BadRequestException('Ein Angebot ohne Positionen kann nicht versendet werden.');
    }

    return prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.VERSENDET, sentAt: new Date() },
      include: { items: { orderBy: { position: 'asc' } }, customer: true },
    });
  }

  async accept(id: string) {
    await this.requireStatus(id, [QuoteStatus.VERSENDET, QuoteStatus.ABGELAUFEN]);
    return prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.ANGENOMMEN, decidedAt: new Date() },
      include: { items: { orderBy: { position: 'asc' } }, customer: true },
    });
  }

  async reject(id: string, dto: RejectQuoteDto) {
    await this.requireStatus(id, [QuoteStatus.VERSENDET, QuoteStatus.ABGELAUFEN]);
    return prisma.quote.update({
      where: { id },
      data: {
        status: QuoteStatus.ABGELEHNT,
        decidedAt: new Date(),
        rejectionReason: dto.reason ?? null,
      },
    });
  }

  /**
   * Erzeugt aus einem angenommenen Angebot einen Auftrag. Optionale Positionen
   * werden nur übernommen, wenn sie ausdrücklich beauftragt wurden.
   */
  async convertToOrder(id: string, dto: ConvertQuoteDto) {
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!quote) {
      throw new NotFoundException('Das Angebot wurde nicht gefunden.');
    }
    if (quote.status !== QuoteStatus.ANGENOMMEN) {
      throw new ConflictException(
        'Nur angenommene Angebote können in einen Auftrag überführt werden.',
      );
    }

    const included = new Set(dto.includeOptionalItemIds ?? []);
    const items = quote.items.filter((item) => !item.optional || included.has(item.id));

    const { prepared, totals } = prepareLineItems(
      items.map((item) => ({
        type: item.type,
        articleId: item.articleId ?? undefined,
        title: item.title,
        description: item.description ?? undefined,
        quantity: item.quantity.toNumber(),
        unit: item.unit,
        unitPrice: item.unitPrice.toNumber(),
        discountPercent: item.discountPercent.toNumber(),
        vatRate: item.vatRate.toNumber(),
      })),
      quote.discountPercent.toNumber(),
    );

    return prisma.$transaction(async (tx) => {
      const orderNumber = await numbers.next('ORDER', tx);
      return tx.order.create({
        data: {
          orderNumber,
          customerId: quote.customerId,
          siteId: quote.siteId,
          quoteId: quote.id,
          type: dto.type ?? 'MONTAGE',
          status: dto.plannedStart ? OrderStatus.EINGEPLANT : OrderStatus.ANGELEGT,
          subject: quote.subject,
          description: quote.introText,
          customerReference: dto.customerReference ?? null,
          plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : null,
          plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : null,
          discountPercent: quote.discountPercent,
          netTotal: totals.netAmount,
          vatTotal: totals.vatAmount,
          grossTotal: totals.grossAmount,
          items: { create: prepared.map(withoutOptionalFlag) },
        },
        include: { items: { orderBy: { position: 'asc' } }, customer: true },
      });
    });
  }

  async remove(id: string) {
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!quote) {
      throw new NotFoundException('Das Angebot wurde nicht gefunden.');
    }
    if (quote._count.orders > 0) {
      throw new ConflictException(
        'Zum Angebot existiert bereits ein Auftrag. Es kann nur storniert werden.',
      );
    }
    if (quote.status !== QuoteStatus.ENTWURF) {
      return prisma.quote.update({ where: { id }, data: { status: QuoteStatus.STORNIERT } });
    }

    await prisma.quote.delete({ where: { id } });
    return { deleted: true, id };
  }

  /**
   * Setzt versendete Angebote nach Ablauf der Gültigkeit auf ABGELAUFEN.
   * Wird täglich vom Zeitplan aufgerufen.
   */
  async expireOverdue(): Promise<number> {
    const result = await prisma.quote.updateMany({
      where: { status: QuoteStatus.VERSENDET, validUntil: { lt: new Date() } },
      data: { status: QuoteStatus.ABGELAUFEN },
    });
    return result.count;
  }

  private async requireStatus(id: string, allowed: QuoteStatus[]) {
    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) {
      throw new NotFoundException('Das Angebot wurde nicht gefunden.');
    }
    if (!allowed.includes(quote.status)) {
      throw new ConflictException(`Diese Aktion ist im Status "${quote.status}" nicht möglich.`);
    }
    return quote;
  }

  /** Kopfdaten eines Angebots ohne Positionen und Rabatt. */
  private scalarFields(dto: UpdateQuoteDto): Prisma.QuoteUpdateInput {
    return {
      ...(dto.customerId ? { customer: { connect: { id: dto.customerId } } } : {}),
      ...(dto.siteId ? { site: { connect: { id: dto.siteId } } } : {}),
      ...(dto.subject === undefined ? {} : { subject: dto.subject }),
      ...(dto.date === undefined ? {} : { date: new Date(dto.date) }),
      ...(dto.validUntil === undefined ? {} : { validUntil: new Date(dto.validUntil) }),
      ...(dto.introText === undefined ? {} : { introText: dto.introText }),
      ...(dto.outroText === undefined ? {} : { outroText: dto.outroText }),
      ...(dto.notes === undefined ? {} : { notes: dto.notes }),
    };
  }
}

export const quotesService = new QuotesService();
