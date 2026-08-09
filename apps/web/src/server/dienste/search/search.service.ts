import { prisma } from '@/server/prisma';

import { EntityType, type SearchHit, type SearchResponse } from '@garagentor/shared';

/** Anzahl Treffer je Entitätstyp. */
const PER_TYPE = 5;

export class SearchService {
  /**
   * Durchsucht die wichtigsten Entitäten gleichzeitig. Die Treffer tragen
   * bereits den Pfad im Frontend, damit die Oberfläche direkt verlinken kann.
   */
  async search(term: string, limit = 30): Promise<SearchResponse> {
    const query = term.trim();
    if (query.length < 2) {
      return { query, total: 0, hits: [] };
    }

    const contains = { contains: query, mode: 'insensitive' as const };

    const [customers, doors, quotes, orders, invoices, articles, inspections, reports, projects] =
      await Promise.all([
        prisma.customer.findMany({
          where: {
            OR: [
              { customerNumber: contains },
              { companyName: contains },
              { lastName: contains },
              { firstName: contains },
              { email: contains },
              { phone: contains },
            ],
          },
          take: PER_TYPE,
          select: {
            id: true,
            customerNumber: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        }),
        prisma.door.findMany({
          where: {
            OR: [
              { doorNumber: contains },
              { location: contains },
              { serialNumber: contains },
              { manufacturer: contains },
              { model: contains },
            ],
          },
          take: PER_TYPE,
          select: {
            id: true,
            doorNumber: true,
            location: true,
            type: true,
            customer: { select: { companyName: true, lastName: true } },
          },
        }),
        prisma.quote.findMany({
          where: { OR: [{ quoteNumber: contains }, { subject: contains }] },
          take: PER_TYPE,
          select: { id: true, quoteNumber: true, subject: true, status: true },
        }),
        prisma.order.findMany({
          where: {
            OR: [{ orderNumber: contains }, { subject: contains }, { customerReference: contains }],
          },
          take: PER_TYPE,
          select: { id: true, orderNumber: true, subject: true, status: true },
        }),
        prisma.invoice.findMany({
          where: { OR: [{ invoiceNumber: contains }, { subject: contains }] },
          take: PER_TYPE,
          select: { id: true, invoiceNumber: true, subject: true, status: true },
        }),
        prisma.article.findMany({
          where: {
            OR: [
              { articleNumber: contains },
              { name: contains },
              { ean: contains },
              { manufacturerNumber: contains },
            ],
          },
          take: PER_TYPE,
          select: { id: true, articleNumber: true, name: true, stock: true, unit: true },
        }),
        prisma.inspection.findMany({
          where: { OR: [{ inspectionNumber: contains }, { inspectorName: contains }] },
          take: PER_TYPE,
          select: {
            id: true,
            inspectionNumber: true,
            date: true,
            result: true,
            door: { select: { doorNumber: true, location: true } },
          },
        }),
        prisma.serviceReport.findMany({
          where: { OR: [{ reportNumber: contains }, { workPerformed: contains }] },
          take: PER_TYPE,
          select: { id: true, reportNumber: true, date: true, workPerformed: true },
        }),
        prisma.project.findMany({
          where: { OR: [{ projectNumber: contains }, { name: contains }] },
          take: PER_TYPE,
          select: { id: true, projectNumber: true, name: true, status: true },
        }),
      ]);

    const hits: SearchHit[] = [
      ...customers.map((customer) => ({
        type: EntityType.CUSTOMER,
        id: customer.id,
        title:
          customer.companyName ??
          [customer.firstName, customer.lastName].filter(Boolean).join(' ') ??
          customer.customerNumber,
        subtitle: [customer.customerNumber, customer.email].filter(Boolean).join(' · '),
        href: `/kunden/${customer.id}`,
      })),
      ...doors.map((door) => ({
        type: EntityType.DOOR,
        id: door.id,
        title: `${door.doorNumber} · ${door.location}`,
        subtitle: [door.type, door.customer.companyName ?? door.customer.lastName]
          .filter(Boolean)
          .join(' · '),
        href: `/tore/${door.id}`,
      })),
      ...quotes.map((quote) => ({
        type: EntityType.QUOTE,
        id: quote.id,
        title: `${quote.quoteNumber} · ${quote.subject}`,
        subtitle: quote.status,
        href: `/angebote/${quote.id}`,
      })),
      ...orders.map((order) => ({
        type: EntityType.ORDER,
        id: order.id,
        title: `${order.orderNumber} · ${order.subject}`,
        subtitle: order.status,
        href: `/auftraege/${order.id}`,
      })),
      ...invoices.map((invoice) => ({
        type: EntityType.INVOICE,
        id: invoice.id,
        title: `${invoice.invoiceNumber} · ${invoice.subject}`,
        subtitle: invoice.status,
        href: `/rechnungen/${invoice.id}`,
      })),
      ...articles.map((article) => ({
        type: EntityType.ARTICLE,
        id: article.id,
        title: `${article.articleNumber} · ${article.name}`,
        subtitle: `Bestand ${article.stock.toNumber()} ${article.unit}`,
        href: `/lager/${article.id}`,
      })),
      ...inspections.map((inspection) => ({
        type: EntityType.INSPECTION,
        id: inspection.id,
        title: `${inspection.inspectionNumber} · ${inspection.door.doorNumber}`,
        subtitle: [inspection.door.location, inspection.result].filter(Boolean).join(' · '),
        href: `/pruefungen/${inspection.id}`,
      })),
      ...reports.map((report) => ({
        type: EntityType.SERVICE_REPORT,
        id: report.id,
        title: report.reportNumber,
        subtitle: report.workPerformed.slice(0, 120),
        href: `/serviceberichte/${report.id}`,
      })),
      ...projects.map((project) => ({
        type: EntityType.PROJECT,
        id: project.id,
        title: `${project.projectNumber} · ${project.name}`,
        subtitle: project.status,
        href: `/projekte/${project.id}`,
      })),
    ];

    return { query, total: hits.length, hits: hits.slice(0, limit) };
  }
}

export const searchService = new SearchService();
