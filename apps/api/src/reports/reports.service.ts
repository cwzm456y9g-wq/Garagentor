import { Injectable } from '@nestjs/common';
import {
  endOfMonth,
  endOfYear,
  round,
  startOfMonth,
  startOfYear,
  toPeriodKey,
  type DashboardSummary,
  type EmployeeHoursRow,
  type OpenItemRow,
  type RevenueBucket,
  type TopCustomerRow,
} from '@garagentor/shared';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { DoorsService } from '../doors/doors.service';
import { ArticlesService } from '../inventory/articles.service';
import { openAmountOf, OPEN_STATUSES } from '../invoices/invoice-status';
import { PrismaService } from '../prisma/prisma.service';

/** Belegarten, die als Umsatz zählen. */
const REVENUE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.OFFEN,
  InvoiceStatus.TEILBEZAHLT,
  InvoiceStatus.BEZAHLT,
  InvoiceStatus.UEBERFAELLIG,
];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly doors: DoorsService,
    private readonly articles: ArticlesService,
  ) {}

  /** Kennzahlen der Startseite. */
  async dashboard(): Promise<DashboardSummary> {
    const now = new Date();
    const yearStart = startOfYear(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);

    const [
      yearRevenue,
      monthRevenue,
      openInvoices,
      openQuotes,
      activeOrders,
      inspections,
      openDefects,
      todayAppointments,
      lowStock,
      stockValue,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { status: { in: REVENUE_STATUSES }, date: { gte: yearStart } },
        _sum: { netTotal: true },
      }),
      this.prisma.invoice.aggregate({
        where: { status: { in: REVENUE_STATUSES }, date: { gte: monthStart, lte: monthEnd } },
        _sum: { netTotal: true },
      }),
      this.prisma.invoice.findMany({
        where: { status: { in: OPEN_STATUSES } },
        select: { grossTotal: true, deductedAmount: true, paidAmount: true, dueDate: true },
      }),
      this.prisma.quote.aggregate({
        where: { status: 'VERSENDET' },
        _sum: { grossTotal: true },
        _count: true,
      }),
      this.prisma.order.count({
        where: { status: { in: ['ANGELEGT', 'EINGEPLANT', 'IN_ARBEIT', 'WARTET_AUF_MATERIAL'] } },
      }),
      this.doors.inspectionsDue(),
      this.prisma.defect.count({ where: { status: { in: ['OFFEN', 'IN_BEARBEITUNG'] } } }),
      this.prisma.appointment.count({
        where: { start: { lte: dayEnd }, end: { gte: dayStart }, status: { not: 'ABGESAGT' } },
      }),
      this.articles.belowMinStock(),
      this.articles.stockValue(),
    ]);

    const openAmount = round(openInvoices.reduce((sum, invoice) => sum + openAmountOf(invoice), 0));
    const overdue = openInvoices.filter((invoice) => invoice.dueDate < now);
    const overdueAmount = round(overdue.reduce((sum, invoice) => sum + openAmountOf(invoice), 0));

    return {
      umsatzLaufendesJahr: round(yearRevenue._sum.netTotal?.toNumber() ?? 0),
      umsatzLaufenderMonat: round(monthRevenue._sum.netTotal?.toNumber() ?? 0),
      offenePostenBetrag: openAmount,
      offenePostenAnzahl: openInvoices.length,
      ueberfaelligBetrag: overdueAmount,
      ueberfaelligAnzahl: overdue.length,
      offeneAngeboteAnzahl: openQuotes._count,
      offeneAngeboteBetrag: round(openQuotes._sum.grossTotal?.toNumber() ?? 0),
      aktiveAuftraegeAnzahl: activeOrders,
      faelligePruefungenAnzahl: inspections.length,
      ueberfaelligePruefungenAnzahl: inspections.filter((row) => row.overdue).length,
      offeneMaengelAnzahl: openDefects,
      termineHeuteAnzahl: todayAppointments,
      artikelUnterMindestbestand: lowStock.length,
      lagerwert: stockValue.lagerwert,
    };
  }

  /** Umsatz je Monat für das angegebene Jahr. */
  async revenueByMonth(year = new Date().getFullYear()): Promise<RevenueBucket[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: REVENUE_STATUSES },
        date: { gte: startOfYear(new Date(year, 0, 1)), lte: endOfYear(new Date(year, 0, 1)) },
      },
      select: { date: true, netTotal: true, grossTotal: true },
    });

    // Alle zwölf Monate erscheinen, auch ohne Umsatz.
    const buckets = new Map<string, RevenueBucket>();
    for (let month = 0; month < 12; month += 1) {
      const key = `${year}-${`${month + 1}`.padStart(2, '0')}`;
      buckets.set(key, { periode: key, netto: 0, brutto: 0, anzahl: 0 });
    }

    for (const invoice of invoices) {
      const bucket = buckets.get(toPeriodKey(invoice.date));
      if (!bucket) continue;
      bucket.netto = round(bucket.netto + invoice.netTotal.toNumber());
      bucket.brutto = round(bucket.brutto + invoice.grossTotal.toNumber());
      bucket.anzahl += 1;
    }

    return [...buckets.values()];
  }

  /** Umsatzstärkste Kunden im Zeitraum. */
  async topCustomers(from?: string, to?: string, limit = 10): Promise<TopCustomerRow[]> {
    const grouped = await this.prisma.invoice.groupBy({
      by: ['customerId'],
      where: {
        status: { in: REVENUE_STATUSES },
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      _sum: { netTotal: true },
      _count: true,
      orderBy: { _sum: { netTotal: 'desc' } },
      take: limit,
    });

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: grouped.map((row) => row.customerId) } },
      select: { id: true, companyName: true, firstName: true, lastName: true },
    });
    const byId = new Map(customers.map((customer) => [customer.id, customer]));

    return grouped.map((row) => {
      const customer = byId.get(row.customerId);
      return {
        customerId: row.customerId,
        name:
          customer?.companyName ??
          [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') ??
          'Unbekannt',
        umsatz: round(row._sum?.netTotal?.toNumber() ?? 0),
        rechnungen: row._count,
      };
    });
  }

  /** Offene Posten mit Verzugstagen, absteigend nach Fälligkeit. */
  async openItems(): Promise<OpenItemRow[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { in: OPEN_STATUSES } },
      include: {
        customer: { select: { id: true, companyName: true, firstName: true, lastName: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    return invoices.map((invoice) => ({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName:
        invoice.customer.companyName ??
        [invoice.customer.firstName, invoice.customer.lastName].filter(Boolean).join(' '),
      date: invoice.date.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      grossTotal: invoice.grossTotal.toNumber(),
      paidAmount: invoice.paidAmount.toNumber(),
      openAmount: openAmountOf(invoice),
      daysOverdue: Math.max(
        0,
        Math.floor((now.getTime() - invoice.dueDate.getTime()) / 86_400_000),
      ),
      dunningLevel: invoice.dunningLevel,
    }));
  }

  /** Erfasste Stunden je Mitarbeiter im Zeitraum. */
  async employeeHours(from?: string, to?: string): Promise<EmployeeHoursRow[]> {
    const where: Prisma.TimeEntryWhereInput = {
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const entries = await this.prisma.timeEntry.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });

    const byEmployee = new Map<string, EmployeeHoursRow>();
    for (const entry of entries) {
      const row = byEmployee.get(entry.employeeId) ?? {
        employeeId: entry.employeeId,
        name: `${entry.employee.firstName} ${entry.employee.lastName}`,
        stunden: 0,
        abrechenbareStunden: 0,
        fahrtzeitStunden: 0,
      };

      const hours = entry.hours.toNumber();
      row.stunden = round(row.stunden + hours);
      if (entry.billable) row.abrechenbareStunden = round(row.abrechenbareStunden + hours);
      if (entry.type === 'FAHRTZEIT') row.fahrtzeitStunden = round(row.fahrtzeitStunden + hours);

      byEmployee.set(entry.employeeId, row);
    }

    return [...byEmployee.values()].sort((a, b) => b.stunden - a.stunden);
  }

  /** Auftragslage nach Status und Art. */
  async orderStatistics() {
    const [byStatus, byType] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['status'],
        _count: true,
        _sum: { netTotal: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.order.groupBy({
        by: ['type'],
        _count: true,
        _sum: { netTotal: true },
        orderBy: { type: 'asc' },
      }),
    ]);

    return {
      nachStatus: byStatus.map((row) => ({
        status: row.status,
        anzahl: row._count,
        netto: round(row._sum?.netTotal?.toNumber() ?? 0),
      })),
      nachArt: byType.map((row) => ({
        art: row.type,
        anzahl: row._count,
        netto: round(row._sum?.netTotal?.toNumber() ?? 0),
      })),
    };
  }

  /** Prüfstatistik des Branchenmoduls. */
  async inspectionStatistics(year = new Date().getFullYear()) {
    const [results, due, defectsBySeverity] = await Promise.all([
      this.prisma.inspection.groupBy({
        by: ['result'],
        where: {
          completedAt: { not: null },
          date: { gte: startOfYear(new Date(year, 0, 1)), lte: endOfYear(new Date(year, 0, 1)) },
        },
        _count: true,
        orderBy: { result: 'asc' },
      }),
      this.doors.inspectionsDue(),
      this.prisma.defect.groupBy({
        by: ['severity'],
        where: { status: { in: ['OFFEN', 'IN_BEARBEITUNG'] } },
        _count: true,
        orderBy: { severity: 'asc' },
      }),
    ]);

    return {
      jahr: year,
      ergebnisse: results.map((row) => ({ ergebnis: row.result, anzahl: row._count })),
      faellig: due.length,
      ueberfaellig: due.filter((row) => row.overdue).length,
      offeneMaengel: defectsBySeverity.map((row) => ({
        schweregrad: row.severity,
        anzahl: row._count,
      })),
    };
  }
}
