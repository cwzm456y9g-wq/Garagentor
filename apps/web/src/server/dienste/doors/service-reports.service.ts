import { prisma } from '@/server/prisma';
import { numbers } from '../common/numbering/number-range.service';
import { ConflictException, NotFoundException } from '@/server/nest-ersatz';
import { addMonths, durationHours, round, type Paginated } from '@garagentor/shared';
import { type Prisma, ServiceReportStatus, StockMovementType } from '@prisma/client';
import { paginate } from '@/server/anfrage';

import type {
  CompleteServiceReportDto,
  CreateMaintenanceContractDto,
  CreateServiceReportDto,
  MaintenanceContractQueryDto,
  RecordMaintenanceDto,
  ServiceReportQueryDto,
  UpdateMaintenanceContractDto,
  UpdateServiceReportDto,
} from './dto/service-report.dto';

export class ServiceReportsService {
  async findAll(query: ServiceReportQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.ServiceReportWhereInput = {
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.doorId ? { doorId: query.doorId } : {}),
      ...(query.technicianId ? { technicianId: query.technicianId } : {}),
      ...(query.customerId ? { door: { customerId: query.customerId } } : {}),
      ...(query.status ? { status: query.status } : {}),
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
              { reportNumber: { contains: query.search, mode: 'insensitive' } },
              { workPerformed: { contains: query.search, mode: 'insensitive' } },
              { faultDescription: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.serviceReport.findMany({
        where,
        include: {
          door: {
            select: {
              id: true,
              doorNumber: true,
              location: true,
              customer: { select: { id: true, companyName: true, lastName: true } },
            },
          },
          order: { select: { id: true, orderNumber: true } },
          technician: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { materials: true } },
        },
        orderBy: { date: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      prisma.serviceReport.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const report = await prisma.serviceReport.findUnique({
      where: { id },
      include: {
        door: { include: { customer: true, site: true } },
        order: { select: { id: true, orderNumber: true, subject: true } },
        technician: { select: { id: true, firstName: true, lastName: true } },
        materials: { include: { article: { select: { articleNumber: true, unit: true } } } },
      },
    });
    if (!report) {
      throw new NotFoundException('Der Servicebericht wurde nicht gefunden.');
    }
    return report;
  }

  async create(dto: CreateServiceReportDto) {
    return prisma.$transaction(async (tx) => {
      const reportNumber = await numbers.next('SERVICE_REPORT', tx);
      return tx.serviceReport.create({
        data: {
          reportNumber,
          orderId: dto.orderId ?? null,
          doorId: dto.doorId ?? null,
          technicianId: dto.technicianId ?? null,
          date: dto.date ? new Date(dto.date) : new Date(),
          arrivalTime: dto.arrivalTime ? new Date(dto.arrivalTime) : null,
          departureTime: dto.departureTime ? new Date(dto.departureTime) : null,
          workHours: this.workHours(dto),
          travelFlatRate: dto.travelFlatRate ?? 0,
          travelKm: dto.travelKm ?? 0,
          faultDescription: dto.faultDescription ?? null,
          workPerformed: dto.workPerformed,
          followUpRequired: dto.followUpRequired ?? false,
          followUpNote: dto.followUpNote ?? null,
          materials: dto.materials
            ? { create: dto.materials.map((material) => this.toMaterial(material)) }
            : undefined,
        },
        include: { materials: true, door: true },
      });
    });
  }

  async update(id: string, dto: UpdateServiceReportDto) {
    const report = await this.requireDraft(id);

    return prisma.$transaction(async (tx) => {
      if (dto.materials) {
        await tx.serviceReportMaterial.deleteMany({ where: { reportId: id } });
        await tx.serviceReportMaterial.createMany({
          data: dto.materials.map((material) => ({ ...this.toMaterial(material), reportId: id })),
        });
      }

      return tx.serviceReport.update({
        where: { id },
        data: {
          ...(dto.orderId === undefined ? {} : { orderId: dto.orderId }),
          ...(dto.doorId === undefined ? {} : { doorId: dto.doorId }),
          ...(dto.technicianId === undefined ? {} : { technicianId: dto.technicianId }),
          ...(dto.date === undefined ? {} : { date: new Date(dto.date) }),
          ...(dto.arrivalTime === undefined
            ? {}
            : { arrivalTime: dto.arrivalTime ? new Date(dto.arrivalTime) : null }),
          ...(dto.departureTime === undefined
            ? {}
            : { departureTime: dto.departureTime ? new Date(dto.departureTime) : null }),
          ...(dto.workHours === undefined && dto.arrivalTime === undefined
            ? {}
            : { workHours: this.workHours({ ...report, ...dto } as CreateServiceReportDto) }),
          ...(dto.travelFlatRate === undefined ? {} : { travelFlatRate: dto.travelFlatRate }),
          ...(dto.travelKm === undefined ? {} : { travelKm: dto.travelKm }),
          ...(dto.faultDescription === undefined ? {} : { faultDescription: dto.faultDescription }),
          ...(dto.workPerformed === undefined ? {} : { workPerformed: dto.workPerformed }),
          ...(dto.followUpRequired === undefined ? {} : { followUpRequired: dto.followUpRequired }),
          ...(dto.followUpNote === undefined ? {} : { followUpNote: dto.followUpNote }),
        },
        include: { materials: true, door: true },
      });
    });
  }

  /**
   * Schließt den Bericht ab und bucht das verbrauchte Material aus dem Lager
   * aus. Danach ist der Bericht als Nachweis unveränderlich.
   */
  async complete(id: string, dto: CompleteServiceReportDto) {
    return prisma.$transaction(async (tx) => {
      // Die Berichtszeile sperren und erst danach den Status prüfen.
      //
      // Der Abschluss bucht Material aus. Lag die Prüfung „ist noch Entwurf"
      // davor, kamen zwei gleichzeitige Abschlüsse beide durch und zogen das
      // Material zweimal vom Bestand ab – ein Doppelklick auf dem Tablet des
      // Monteurs genügt dafür.
      await tx.$queryRaw`SELECT id FROM service_reports WHERE id = ${id} FOR UPDATE`;

      const report = await tx.serviceReport.findUnique({ where: { id } });
      if (!report) {
        throw new NotFoundException('Der Servicebericht wurde nicht gefunden.');
      }
      if (report.status !== ServiceReportStatus.ENTWURF) {
        throw new ConflictException(
          'Der Servicebericht ist abgeschlossen und kann nicht mehr geändert werden.',
        );
      }

      const materials = await tx.serviceReportMaterial.findMany({
        where: { reportId: id, articleId: { not: null } },
        include: { article: true },
      });

      if (dto.deductStock !== false) {
        for (const material of materials) {
          if (!material.article?.stockManaged) continue;

          const quantity = material.quantity.toNumber();
          const updated = await tx.article.update({
            where: { id: material.articleId! },
            data: { stock: { decrement: quantity } },
          });

          await tx.stockMovement.create({
            data: {
              articleId: material.articleId!,
              type: StockMovementType.ABGANG,
              quantity,
              stockAfter: updated.stock,
              orderId: report.orderId,
              reference: report.reportNumber,
              note: 'Materialverbrauch laut Servicebericht',
            },
          });
        }
      }

      return tx.serviceReport.update({
        where: { id },
        data: {
          status: ServiceReportStatus.ABGESCHLOSSEN,
          signatureCustomer: dto.signatureCustomer ?? null,
          signatureTechnician: dto.signatureTechnician ?? null,
          signedByName: dto.signedByName ?? null,
          completedAt: new Date(),
        },
        include: { materials: true },
      });
    });
  }

  async remove(id: string) {
    const report = await prisma.serviceReport.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Der Servicebericht wurde nicht gefunden.');
    }
    if (report.status !== ServiceReportStatus.ENTWURF) {
      throw new ConflictException(
        'Abgeschlossene Serviceberichte sind Nachweise und können nicht gelöscht werden.',
      );
    }

    await prisma.serviceReport.delete({ where: { id } });
    return { deleted: true, id };
  }

  /* Wartungsverträge ---------------------------------------------------- */

  async findContracts(query: MaintenanceContractQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.MaintenanceContractWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dueOnly ? { status: 'AKTIV', nextServiceDate: { lte: new Date() } } : {}),
      ...(query.search
        ? {
            OR: [
              { contractNumber: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.maintenanceContract.findMany({
        where,
        include: {
          customer: {
            select: { id: true, customerNumber: true, companyName: true, lastName: true },
          },
          doors: { select: { id: true, doorNumber: true, location: true } },
        },
        orderBy: { nextServiceDate: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      prisma.maintenanceContract.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findContract(id: string) {
    const contract = await prisma.maintenanceContract.findUnique({
      where: { id },
      include: {
        customer: true,
        doors: {
          select: {
            id: true,
            doorNumber: true,
            location: true,
            type: true,
            nextInspectionDue: true,
          },
        },
      },
    });
    if (!contract) {
      throw new NotFoundException('Der Wartungsvertrag wurde nicht gefunden.');
    }
    return contract;
  }

  async createContract(dto: CreateMaintenanceContractDto) {
    const startDate = new Date(dto.startDate);
    const intervalMonths = dto.intervalMonths ?? 12;

    return prisma.$transaction(async (tx) => {
      const contractNumber = await numbers.next('MAINTENANCE_CONTRACT', tx);
      return tx.maintenanceContract.create({
        data: {
          contractNumber,
          customerId: dto.customerId,
          title: dto.title,
          intervalMonths,
          price: dto.price ?? 0,
          startDate,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          noticePeriodMonths: dto.noticePeriodMonths ?? 3,
          includesInspection: dto.includesInspection ?? true,
          // Der erste Einsatz steht ein Intervall nach Vertragsbeginn an.
          nextServiceDate: addMonths(startDate, intervalMonths),
          notes: dto.notes ?? null,
          doors: dto.doorIds
            ? { connect: dto.doorIds.map((doorId) => ({ id: doorId })) }
            : undefined,
        },
        include: { doors: true, customer: true },
      });
    });
  }

  async updateContract(id: string, dto: UpdateMaintenanceContractDto) {
    const contract = await prisma.maintenanceContract.findUnique({ where: { id } });
    if (!contract) {
      throw new NotFoundException('Der Wartungsvertrag wurde nicht gefunden.');
    }

    return prisma.maintenanceContract.update({
      where: { id },
      data: {
        ...(dto.title === undefined ? {} : { title: dto.title }),
        ...(dto.status === undefined ? {} : { status: dto.status }),
        ...(dto.intervalMonths === undefined ? {} : { intervalMonths: dto.intervalMonths }),
        ...(dto.price === undefined ? {} : { price: dto.price }),
        ...(dto.startDate === undefined ? {} : { startDate: new Date(dto.startDate) }),
        ...(dto.endDate === undefined
          ? {}
          : { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.noticePeriodMonths === undefined
          ? {}
          : { noticePeriodMonths: dto.noticePeriodMonths }),
        ...(dto.includesInspection === undefined
          ? {}
          : { includesInspection: dto.includesInspection }),
        ...(dto.notes === undefined ? {} : { notes: dto.notes }),
        // Die Torliste wird vollständig ersetzt, nicht ergänzt.
        ...(dto.doorIds === undefined
          ? {}
          : { doors: { set: dto.doorIds.map((doorId) => ({ id: doorId })) } }),
      },
      include: { doors: true, customer: true },
    });
  }

  /** Vermerkt einen erfolgten Wartungseinsatz und terminiert den nächsten. */
  async recordMaintenance(id: string, dto: RecordMaintenanceDto) {
    const contract = await prisma.maintenanceContract.findUnique({ where: { id } });
    if (!contract) {
      throw new NotFoundException('Der Wartungsvertrag wurde nicht gefunden.');
    }

    const date = dto.date ? new Date(dto.date) : new Date();
    return prisma.maintenanceContract.update({
      where: { id },
      data: {
        lastServiceDate: date,
        nextServiceDate: addMonths(date, contract.intervalMonths),
      },
      include: { doors: true },
    });
  }

  async removeContract(id: string) {
    const contract = await prisma.maintenanceContract.findUnique({ where: { id } });
    if (!contract) {
      throw new NotFoundException('Der Wartungsvertrag wurde nicht gefunden.');
    }

    // Gelaufene Verträge werden gekündigt statt gelöscht.
    if (contract.lastServiceDate) {
      return prisma.maintenanceContract.update({
        where: { id },
        data: { status: 'GEKUENDIGT', nextServiceDate: null },
      });
    }

    await prisma.maintenanceContract.delete({ where: { id } });
    return { deleted: true, id };
  }

  /**
   * Setzt abgelaufene Verträge auf ABGELAUFEN. Wird täglich aufgerufen.
   */
  async expireContracts(): Promise<number> {
    const result = await prisma.maintenanceContract.updateMany({
      where: { status: 'AKTIV', endDate: { lt: new Date() } },
      data: { status: 'ABGELAUFEN', nextServiceDate: null },
    });
    return result.count;
  }

  /* Interna -------------------------------------------------------------- */

  private async requireDraft(id: string) {
    const report = await prisma.serviceReport.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Der Servicebericht wurde nicht gefunden.');
    }
    if (report.status !== ServiceReportStatus.ENTWURF) {
      throw new ConflictException(
        'Der Servicebericht ist abgeschlossen und kann nicht mehr geändert werden.',
      );
    }
    return report;
  }

  /** Arbeitszeit aus An- und Abfahrtzeit, sofern nicht ausdrücklich angegeben. */
  private workHours(dto: Partial<CreateServiceReportDto>): number {
    if (dto.workHours !== undefined) return dto.workHours;
    if (dto.arrivalTime && dto.departureTime) {
      return durationHours(dto.arrivalTime, dto.departureTime);
    }
    return 0;
  }

  private toMaterial(material: {
    articleId?: string;
    name: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
  }) {
    return {
      articleId: material.articleId ?? null,
      name: material.name,
      quantity: material.quantity,
      unit: material.unit ?? 'Stk',
      unitPrice: round(material.unitPrice ?? 0),
    };
  }
}

export const serviceReportsService = new ServiceReportsService();
