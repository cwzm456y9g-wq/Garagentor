import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { round, type Paginated } from '@garagentor/shared';
import { AddressType, Prisma } from '@prisma/client';
import { orderBy, paginate } from '../common/dto/pagination.dto';
import { NumberRangeService } from '../common/numbering/number-range.service';
import { openAmountOf } from '../invoices/invoice-status';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateAddressDto,
  CreateContactDto,
  CreateCustomerDto,
  CreateSiteDto,
  CustomerQueryDto,
  UpdateAddressDto,
  UpdateContactDto,
  UpdateCustomerDto,
  UpdateSiteDto,
} from './dto/customer.dto';

const SORTABLE = ['customerNumber', 'companyName', 'lastName', 'createdAt'] as const;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: NumberRangeService,
  ) {}

  async findAll(query: CustomerQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.CustomerWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.search
        ? {
            OR: [
              { customerNumber: { contains: query.search, mode: 'insensitive' } },
              { companyName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: {
          addresses: { where: { type: AddressType.RECHNUNG }, take: 1 },
          _count: { select: { doors: true, orders: true, invoices: true } },
        },
        orderBy: orderBy(query, SORTABLE, { customerNumber: 'asc' }),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: { orderBy: [{ isDefault: 'desc' }, { type: 'asc' }] },
        contacts: { orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }] },
        sites: { where: { active: true }, orderBy: { name: 'asc' } },
        _count: { select: { doors: true, quotes: true, orders: true, invoices: true } },
      },
    });
    if (!customer) {
      throw new NotFoundException('Der Kunde wurde nicht gefunden.');
    }
    return customer;
  }

  /** Offene Posten und Umsatz für die Kundenakte. */
  async statistics(id: string) {
    await this.assertExists(id);

    const [revenue, open, lastInvoice, openQuotes] = await this.prisma.$transaction([
      this.prisma.invoice.aggregate({
        where: { customerId: id, status: { notIn: ['ENTWURF', 'STORNIERT'] } },
        _sum: { netTotal: true, grossTotal: true },
        _count: true,
      }),
      this.prisma.invoice.findMany({
        where: { customerId: id, status: { in: ['OFFEN', 'TEILBEZAHLT', 'UEBERFAELLIG'] } },
        select: { grossTotal: true, deductedAmount: true, paidAmount: true, dueDate: true },
      }),
      this.prisma.invoice.findFirst({
        where: { customerId: id, status: { not: 'ENTWURF' } },
        orderBy: { date: 'desc' },
        select: { invoiceNumber: true, date: true, grossTotal: true },
      }),
      this.prisma.quote.count({ where: { customerId: id, status: 'VERSENDET' } }),
    ]);

    const now = new Date();
    const openAmount = open.reduce((sum, invoice) => sum + openAmountOf(invoice), 0);
    const overdueAmount = open
      .filter((invoice) => invoice.dueDate < now)
      .reduce((sum, invoice) => sum + openAmountOf(invoice), 0);

    return {
      umsatzNetto: revenue._sum.netTotal?.toNumber() ?? 0,
      umsatzBrutto: revenue._sum.grossTotal?.toNumber() ?? 0,
      rechnungenAnzahl: revenue._count,
      offenePosten: round(openAmount),
      offenePostenAnzahl: open.length,
      ueberfaellig: round(overdueAmount),
      offeneAngebote: openQuotes,
      letzteRechnung: lastInvoice,
    };
  }

  async create(dto: CreateCustomerDto) {
    return this.prisma.$transaction(async (tx) => {
      const customerNumber = await this.numbers.next('CUSTOMER', tx);
      return tx.customer.create({
        data: { ...dto, customerNumber },
        include: { addresses: true, contacts: true, sites: true },
      });
    });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.assertExists(id);
    return this.prisma.customer.update({
      where: { id },
      data: dto,
      include: { addresses: true, contacts: true, sites: true },
    });
  }

  /**
   * Kunden mit Belegen dürfen aus buchhalterischen Gründen nicht gelöscht,
   * sondern nur deaktiviert werden.
   */
  async remove(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { quotes: true, orders: true, invoices: true, doors: true } } },
    });
    if (!customer) {
      throw new NotFoundException('Der Kunde wurde nicht gefunden.');
    }

    const { quotes, orders, invoices, doors } = customer._count;
    if (quotes + orders + invoices + doors > 0) {
      return this.prisma.customer.update({ where: { id }, data: { active: false } });
    }

    await this.prisma.customer.delete({ where: { id } });
    return { deleted: true, id };
  }

  /* Adressen ----------------------------------------------------------- */

  async addAddress(customerId: string, dto: CreateAddressDto) {
    await this.assertExists(customerId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { customerId, type: dto.type },
          data: { isDefault: false },
        });
      }
      return tx.address.create({ data: { ...dto, customerId } });
    });
  }

  async updateAddress(customerId: string, addressId: string, dto: UpdateAddressDto) {
    const address = await this.prisma.address.findFirst({ where: { id: addressId, customerId } });
    if (!address) {
      throw new NotFoundException('Die Adresse wurde nicht gefunden.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { customerId, type: dto.type ?? address.type, id: { not: addressId } },
          data: { isDefault: false },
        });
      }
      return tx.address.update({ where: { id: addressId }, data: dto });
    });
  }

  async removeAddress(customerId: string, addressId: string) {
    const result = await this.prisma.address.deleteMany({ where: { id: addressId, customerId } });
    if (result.count === 0) {
      throw new NotFoundException('Die Adresse wurde nicht gefunden.');
    }
    return { deleted: true, id: addressId };
  }

  /* Ansprechpartner ---------------------------------------------------- */

  async addContact(customerId: string, dto: CreateContactDto) {
    await this.assertExists(customerId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.contact.updateMany({ where: { customerId }, data: { isPrimary: false } });
      }
      return tx.contact.create({ data: { ...dto, customerId } });
    });
  }

  async updateContact(customerId: string, contactId: string, dto: UpdateContactDto) {
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, customerId } });
    if (!contact) {
      throw new NotFoundException('Der Ansprechpartner wurde nicht gefunden.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.contact.updateMany({
          where: { customerId, id: { not: contactId } },
          data: { isPrimary: false },
        });
      }
      return tx.contact.update({ where: { id: contactId }, data: dto });
    });
  }

  async removeContact(customerId: string, contactId: string) {
    const result = await this.prisma.contact.deleteMany({ where: { id: contactId, customerId } });
    if (result.count === 0) {
      throw new NotFoundException('Der Ansprechpartner wurde nicht gefunden.');
    }
    return { deleted: true, id: contactId };
  }

  /* Objekte ------------------------------------------------------------ */

  async addSite(customerId: string, dto: CreateSiteDto) {
    await this.assertExists(customerId);
    return this.prisma.site.create({ data: { ...dto, customerId } });
  }

  async updateSite(customerId: string, siteId: string, dto: UpdateSiteDto) {
    const site = await this.prisma.site.findFirst({ where: { id: siteId, customerId } });
    if (!site) {
      throw new NotFoundException('Das Objekt wurde nicht gefunden.');
    }
    return this.prisma.site.update({ where: { id: siteId }, data: dto });
  }

  async removeSite(customerId: string, siteId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, customerId },
      include: { _count: { select: { doors: true, orders: true } } },
    });
    if (!site) {
      throw new NotFoundException('Das Objekt wurde nicht gefunden.');
    }

    if (site._count.doors > 0 || site._count.orders > 0) {
      // Toranlagen und Aufträge verweisen auf das Objekt – nur deaktivieren.
      return this.prisma.site.update({ where: { id: siteId }, data: { active: false } });
    }

    await this.prisma.site.delete({ where: { id: siteId } });
    return { deleted: true, id: siteId };
  }

  /** Wird auch von anderen Modulen genutzt, um Kundenbezüge zu prüfen. */
  async assertExists(id: string): Promise<void> {
    const count = await this.prisma.customer.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException('Der Kunde wurde nicht gefunden.');
    }
  }

  /** Prüft, dass ein Objekt zum angegebenen Kunden gehört. */
  async assertSiteBelongsToCustomer(siteId: string, customerId: string): Promise<void> {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) {
      throw new NotFoundException('Das Objekt wurde nicht gefunden.');
    }
    if (site.customerId !== customerId) {
      throw new BadRequestException('Das Objekt gehört nicht zum angegebenen Kunden.');
    }
  }
}
