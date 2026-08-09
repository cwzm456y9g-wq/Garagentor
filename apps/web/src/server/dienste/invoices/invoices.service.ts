import { prisma } from '@/server/prisma';
import { audit } from '../common/audit/audit.service';
import { customers } from '../customers/customers.service';
import { numbers } from '../common/numbering/number-range.service';
import { BadRequestException, ConflictException, NotFoundException } from '@/server/nest-ersatz';
import {
  abgleichMitSkonto,
  addDays,
  round,
  skontoAmount,
  withinSkontoPeriod,
  type Paginated,
} from '@garagentor/shared';
import { InvoiceStatus, InvoiceType, type Prisma, type Invoice } from '@prisma/client';
import { prepareLineItems, withoutOptionalFlag } from '../common/dto/line-item.dto';
import { orderBy, paginate } from '@/server/anfrage';

import { openAmountOf, OPEN_STATUSES, payableAmountOf } from './invoice-status';
import type {
  CancelInvoiceDto,
  CreateInvoiceDto,
  CreatePaymentDto,
  InvoiceQueryDto,
  UpdateInvoiceDto,
} from './dto/invoice.dto';

const SORTABLE = ['invoiceNumber', 'date', 'dueDate', 'grossTotal', 'status'] as const;

export class InvoicesService {
  async findAll(query: InvoiceQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.InvoiceWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.openOnly ? { status: { in: OPEN_STATUSES } } : {}),
      ...(query.overdueOnly ? { status: { in: OPEN_STATUSES }, dueDate: { lt: new Date() } } : {}),
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
              { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
              { subject: { contains: query.search, mode: 'insensitive' } },
              { customer: { companyName: { contains: query.search, mode: 'insensitive' } } },
              { customer: { lastName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.invoice.findMany({
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
          order: { select: { id: true, orderNumber: true } },
          _count: { select: { payments: true, dunnings: true } },
        },
        orderBy: orderBy(query, SORTABLE, { date: 'desc' }),
        skip: query.skip,
        take: query.take,
      }),
      prisma.invoice.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: { include: { addresses: true } },
        order: { select: { id: true, orderNumber: true, subject: true } },
        items: { orderBy: { position: 'asc' } },
        payments: { orderBy: { date: 'desc' } },
        dunnings: { orderBy: { date: 'desc' } },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Die Rechnung wurde nicht gefunden.');
    }
    return {
      ...invoice,
      payableAmount: this.payableAmount(invoice),
      openAmount: this.openAmount(invoice),
    };
  }

  async create(dto: CreateInvoiceDto) {
    await customers.assertExists(dto.customerId);

    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id: dto.customerId },
    });

    const date = dto.date ? new Date(dto.date) : new Date();
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : addDays(date, customer.paymentTermsDays);
    const vorgabe = await this.skontoVorgabe();
    if (dueDate < date) {
      throw new BadRequestException(
        'Das Fälligkeitsdatum darf nicht vor dem Rechnungsdatum liegen.',
      );
    }

    const { prepared, totals } = prepareLineItems(dto.items, dto.discountPercent ?? 0);

    return prisma.$transaction(async (tx) => {
      const invoiceNumber = await numbers.next('INVOICE', tx);
      return tx.invoice.create({
        data: {
          invoiceNumber,
          type: dto.type ?? InvoiceType.RECHNUNG,
          customerId: dto.customerId,
          orderId: dto.orderId ?? null,
          subject: dto.subject,
          date,
          dueDate,
          serviceDate: dto.serviceDate ? new Date(dto.serviceDate) : null,
          introText: dto.introText ?? null,
          outroText: dto.outroText ?? null,
          notes: dto.notes ?? null,
          discountPercent: dto.discountPercent ?? 0,
          skontoPercent: dto.skontoPercent ?? vorgabe.skontoPercent,
          skontoDays: dto.skontoDays ?? vorgabe.skontoDays,
          netTotal: totals.netAmount,
          vatTotal: totals.vatAmount,
          grossTotal: totals.grossAmount,
          items: { create: prepared.map(withoutOptionalFlag) },
        },
        include: { items: { orderBy: { position: 'asc' } }, customer: true },
      });
    });
  }

  /** Nur Entwürfe sind änderbar – festgeschriebene Rechnungen bleiben unverändert. */
  async update(id: string, dto: UpdateInvoiceDto) {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new NotFoundException('Die Rechnung wurde nicht gefunden.');
    }
    if (invoice.status !== InvoiceStatus.ENTWURF) {
      throw new ConflictException(
        'Festgeschriebene Rechnungen können nicht geändert werden. ' +
          'Bitte stornieren und neu erstellen.',
      );
    }

    const discountPercent = dto.discountPercent ?? invoice.discountPercent.toNumber();

    return prisma.$transaction(async (tx) => {
      let totals: { netAmount: number; vatAmount: number; grossAmount: number };

      if (dto.items) {
        const prepared = prepareLineItems(dto.items, discountPercent);
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceItem.createMany({
          data: prepared.prepared.map((item) => ({ ...withoutOptionalFlag(item), invoiceId: id })),
        });
        totals = prepared.totals;
      } else {
        const items = await tx.invoiceItem.findMany({ where: { invoiceId: id } });
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

      return tx.invoice.update({
        where: { id },
        data: {
          ...(dto.subject === undefined ? {} : { subject: dto.subject }),
          ...(dto.date === undefined ? {} : { date: new Date(dto.date) }),
          ...(dto.dueDate === undefined ? {} : { dueDate: new Date(dto.dueDate) }),
          ...(dto.serviceDate === undefined
            ? {}
            : { serviceDate: dto.serviceDate ? new Date(dto.serviceDate) : null }),
          ...(dto.introText === undefined ? {} : { introText: dto.introText }),
          ...(dto.outroText === undefined ? {} : { outroText: dto.outroText }),
          ...(dto.notes === undefined ? {} : { notes: dto.notes }),
          ...(dto.type === undefined ? {} : { type: dto.type }),
          ...(dto.skontoPercent === undefined ? {} : { skontoPercent: dto.skontoPercent }),
          ...(dto.skontoDays === undefined ? {} : { skontoDays: dto.skontoDays }),
          discountPercent,
          netTotal: totals.netAmount,
          vatTotal: totals.vatAmount,
          grossTotal: totals.grossAmount,
        },
        include: { items: { orderBy: { position: 'asc' } }, customer: true },
      });
    });
  }

  /**
   * Schreibt die Rechnung fest und stellt sie zu. Ab hier ist sie inhaltlich
   * unveränderlich und wird als offener Posten geführt.
   */
  async send(id: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    if (!invoice) {
      throw new NotFoundException('Die Rechnung wurde nicht gefunden.');
    }
    if (invoice.status !== InvoiceStatus.ENTWURF) {
      throw new ConflictException('Die Rechnung wurde bereits festgeschrieben.');
    }
    if (invoice._count.items === 0) {
      throw new BadRequestException('Eine Rechnung ohne Positionen kann nicht gestellt werden.');
    }

    return prisma.$transaction(async (tx) => {
      const gestellt = await tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.OFFEN, sentAt: new Date() },
        include: { customer: true },
      });

      // Ab hier ist der Beleg unveränderlich; der Übergang gehört protokolliert.
      await audit.record(
        tx,
        'RECHNUNG_GESTELLT',
        { entityType: 'INVOICE', entityId: id, label: invoice.invoiceNumber },
        { von: InvoiceStatus.ENTWURF, nach: InvoiceStatus.OFFEN, brutto: gestellt.grossTotal },
      );

      return gestellt;
    });
  }

  /**
   * Bucht eine Zahlung und schreibt den Rechnungsstatus fort. Überzahlungen
   * werden abgewiesen, damit der offene Posten nicht negativ wird.
   */
  async addPayment(id: string, dto: CreatePaymentDto) {
    const zahlungsdatum = dto.date ? new Date(dto.date) : new Date();
    // Die Skonto-Toleranz ist eine Einstellung, keine Eigenschaft der
    // Rechnung – sie darf außerhalb der Sperre gelesen werden.
    const toleranz = await this.skontoToleranz();

    return prisma.$transaction(async (tx) => {
      // Die Rechnungszeile bis zum Ende der Transaktion sperren und erst
      // danach lesen.
      //
      // Vorher standen Prüfung und Rechnen davor, geschrieben wurde ein
      // ausgerechneter Gesamtbetrag. Zwei gleichzeitige Zahlungen sahen beide
      // denselben offenen Posten: Bei 1.000 € offen kamen zweimal 600 € durch,
      // und die zweite Buchung überschrieb die erste – zwei Zahlungen über
      // zusammen 1.200 € in der Liste, aber 600 € als gezahlt vermerkt. Ein
      // Doppelklick genügt dafür.
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${id} FOR UPDATE`;

      const invoice = await tx.invoice.findUnique({ where: { id } });
      if (!invoice) {
        throw new NotFoundException('Die Rechnung wurde nicht gefunden.');
      }
      if (invoice.status === InvoiceStatus.ENTWURF) {
        throw new ConflictException('Zu einem Rechnungsentwurf kann keine Zahlung gebucht werden.');
      }
      if (invoice.status === InvoiceStatus.STORNIERT) {
        throw new ConflictException(
          'Zu einer stornierten Rechnung kann keine Zahlung gebucht werden.',
        );
      }

      const open = this.openAmount(invoice);
      if (dto.amount > open + 0.01) {
        throw new BadRequestException(
          `Der Zahlbetrag übersteigt den offenen Betrag von ${open.toFixed(2)} €.`,
        );
      }

      // Skonto steht nur zu, wenn fristgerecht gezahlt wurde. Außerhalb der
      // Frist geht der Abgleich mit null Abzug hinein und wertet eine
      // geminderte Zahlung damit als Unterzahlung.
      const skontosatz = invoice.skontoPercent.toNumber();
      const zulaessig =
        skontosatz > 0 && withinSkontoPeriod(zahlungsdatum, invoice.date, invoice.skontoDays)
          ? skontoAmount(payableAmountOf(invoice), skontosatz)
          : 0;

      const abgleich = abgleichMitSkonto({
        offen: open,
        zahlung: dto.amount,
        skonto: zulaessig,
        toleranz,
      });

      await tx.payment.create({
        data: {
          invoiceId: id,
          amount: dto.amount,
          date: zahlungsdatum,
          method: dto.method ?? 'UEBERWEISUNG',
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
        },
      });

      // Die Summe kommt aus den Zahlungen selbst, nicht aus dem fortge-
      // schriebenen Feld. Was gebucht ist, steht in der Liste – das Feld ist
      // nur die Zusammenfassung und darf ihr nicht widersprechen.
      const summe = await tx.payment.aggregate({
        where: { invoiceId: id },
        _sum: { amount: true },
      });

      const paidAmount = round(summe._sum.amount?.toNumber() ?? 0);
      const fullyPaid = abgleich.ausgeglichen;
      const skonto = round(invoice.skontoAmount.toNumber() + abgleich.skonto);

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          paidAmount,
          skontoAmount: skonto,
          status: fullyPaid ? InvoiceStatus.BEZAHLT : InvoiceStatus.TEILBEZAHLT,
          paidAt: fullyPaid ? new Date() : null,
        },
        include: { payments: { orderBy: { date: 'desc' } } },
      });

      await audit.record(
        tx,
        'ZAHLUNG_GEBUCHT',
        { entityType: 'INVOICE', entityId: id, label: invoice.invoiceNumber },
        {
          betrag: dto.amount,
          gezahltGesamt: paidAmount,
          vollstaendig: fullyPaid,
          // Ein gewährter Abzug ist ein Ertragsverzicht und gehört ins
          // Protokoll, nicht nur in die Summenzeile.
          ...(abgleich.skonto > 0 ? { skonto: abgleich.skonto } : {}),
        },
      );

      // Mit dem vollständigen Ausgleich sind offene Mahnungen erledigt.
      if (fullyPaid) {
        await tx.dunning.updateMany({
          where: { invoiceId: id, status: { in: ['ENTWURF', 'VERSENDET'] } },
          data: { status: 'ERLEDIGT' },
        });
      }

      return updated;
    });
  }

  async removePayment(id: string, paymentId: string) {
    return prisma.$transaction(async (tx) => {
      // Dieselbe Sperre wie beim Buchen: Sonst könnten Löschen und Buchen
      // einander überschreiben.
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${id} FOR UPDATE`;

      const payment = await tx.payment.findFirst({
        where: { id: paymentId, invoiceId: id },
      });
      if (!payment) {
        throw new NotFoundException('Die Zahlung wurde nicht gefunden.');
      }

      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id } });

      await tx.payment.delete({ where: { id: paymentId } });

      const summe = await tx.payment.aggregate({
        where: { invoiceId: id },
        _sum: { amount: true },
      });

      const paidAmount = round(summe._sum.amount?.toNumber() ?? 0);
      const overdue = invoice.dueDate < new Date();

      return tx.invoice.update({
        where: { id },
        data: {
          paidAmount,
          status:
            paidAmount <= 0
              ? overdue
                ? InvoiceStatus.UEBERFAELLIG
                : InvoiceStatus.OFFEN
              : InvoiceStatus.TEILBEZAHLT,
          paidAt: null,
        },
      });
    });
  }

  /**
   * Storniert die Rechnung. Ist bereits Geld geflossen, wird zusätzlich eine
   * Gutschrift über den gezahlten Betrag erzeugt.
   */
  async cancel(id: string, dto: CancelInvoiceDto) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!invoice) {
      throw new NotFoundException('Die Rechnung wurde nicht gefunden.');
    }
    if (invoice.status === InvoiceStatus.STORNIERT) {
      throw new ConflictException('Die Rechnung ist bereits storniert.');
    }
    if (invoice.status === InvoiceStatus.ENTWURF) {
      // Ein Entwurf war nie ein Beleg und wird entfernt statt storniert.
      await prisma.$transaction(async (tx) => {
        await audit.record(tx, 'RECHNUNGSENTWURF_GELOESCHT', {
          entityType: 'INVOICE',
          entityId: id,
          label: invoice.invoiceNumber,
        });
        await tx.invoice.delete({ where: { id } });
      });
      return { deleted: true, id };
    }

    return prisma.$transaction(async (tx) => {
      const cancelled = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.STORNIERT,
          cancelledAt: new Date(),
          notes: dto.reason
            ? `${invoice.notes ? `${invoice.notes}\n` : ''}Storniert: ${dto.reason}`
            : invoice.notes,
        },
      });

      // Offene Mahnungen zu einer stornierten Rechnung werden hinfällig.
      await tx.dunning.updateMany({
        where: { invoiceId: id, status: { in: ['ENTWURF', 'VERSENDET'] } },
        data: { status: 'ABGEBROCHEN' },
      });

      await audit.record(
        tx,
        'RECHNUNG_STORNIERT',
        { entityType: 'INVOICE', entityId: id, label: invoice.invoiceNumber },
        { von: invoice.status, grund: dto.reason ?? null, brutto: invoice.grossTotal },
      );

      if (invoice.paidAmount.toNumber() <= 0) {
        return { invoice: cancelled, creditNote: null };
      }

      const creditNumber = await numbers.next('INVOICE', tx);
      const creditNote = await tx.invoice.create({
        data: {
          invoiceNumber: creditNumber,
          type: InvoiceType.GUTSCHRIFT,
          status: InvoiceStatus.OFFEN,
          customerId: invoice.customerId,
          orderId: invoice.orderId,
          date: new Date(),
          dueDate: new Date(),
          subject: `Gutschrift zu Rechnung ${invoice.invoiceNumber}`,
          netTotal: invoice.netTotal.negated(),
          vatTotal: invoice.vatTotal.negated(),
          grossTotal: invoice.grossTotal.negated(),
          items: {
            create: invoice.items.map((item) => ({
              position: item.position,
              type: item.type,
              articleId: item.articleId,
              title: item.title,
              description: item.description,
              quantity: item.quantity.negated(),
              unit: item.unit,
              unitPrice: item.unitPrice,
              discountPercent: item.discountPercent,
              vatRate: item.vatRate,
              netAmount: item.netAmount.negated(),
            })),
          },
        },
      });

      return { invoice: cancelled, creditNote };
    });
  }

  /**
   * Markiert fällige offene Posten als überfällig. Wird täglich aufgerufen und
   * bildet die Grundlage des Mahnlaufs.
   */
  async markOverdue(): Promise<number> {
    const result = await prisma.invoice.updateMany({
      where: {
        status: { in: [InvoiceStatus.OFFEN, InvoiceStatus.TEILBEZAHLT] },
        dueDate: { lt: new Date() },
      },
      data: { status: InvoiceStatus.UEBERFAELLIG },
    });
    return result.count;
  }

  /**
   * Erlaubte Abweichung beim Zahlungsabgleich, in Euro.
   *
   * Voreingestellt fünf Cent: das deckt das Runden des Kunden ab, ohne dass
   * eine echte Unterzahlung durchrutscht.
   */
  /** Skontovorgaben für neue Rechnungen. */
  private async skontoVorgabe(): Promise<{ skontoPercent: number; skontoDays: number }> {
    const setting = await prisma.setting.findUnique({ where: { key: 'belege' } });
    const wert = (setting?.value as { skontoPercent?: number; skontoDays?: number } | null) ?? {};
    return {
      skontoPercent: typeof wert.skontoPercent === 'number' ? wert.skontoPercent : 0,
      skontoDays: typeof wert.skontoDays === 'number' ? wert.skontoDays : 0,
    };
  }

  private async skontoToleranz(): Promise<number> {
    const setting = await prisma.setting.findUnique({ where: { key: 'belege' } });
    const wert = (setting?.value as { skontoToleranz?: number } | null)?.skontoToleranz;
    return typeof wert === 'number' && wert >= 0 ? wert : 0.05;
  }

  /** Zu zahlender Betrag abzüglich verrechneter Abschläge. */
  payableAmount(invoice: Pick<Invoice, 'grossTotal' | 'deductedAmount'>): number {
    return payableAmountOf(invoice);
  }

  /** Noch offener Betrag einer Rechnung. */
  openAmount(invoice: Pick<Invoice, 'grossTotal' | 'deductedAmount' | 'paidAmount'>): number {
    return openAmountOf(invoice);
  }
}

export const invoicesService = new InvoicesService();
