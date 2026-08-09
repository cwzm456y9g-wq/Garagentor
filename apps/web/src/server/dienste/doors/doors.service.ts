import { prisma } from '@/server/prisma';
import { customers } from '../customers/customers.service';
import { numbers } from '../common/numbering/number-range.service';
import { NotFoundException } from '@/server/nest-ersatz';
import {
  addMonths,
  daysBetween,
  INSPECTION_DUE_SOON_DAYS,
  INSPECTION_INTERVAL_MONTHS,
  type InspectionDueRow,
  type Paginated,
} from '@garagentor/shared';
import { OperationMode, type Prisma } from '@prisma/client';
import { orderBy, paginate } from '@/server/anfrage';

import type { CreateDoorDto, DoorQueryDto, UpdateDoorDto } from './dto/door.dto';

const SORTABLE = ['doorNumber', 'location', 'nextInspectionDue', 'createdAt'] as const;

export class DoorsService {
  async findAll(query: DoorQueryDto): Promise<Paginated<unknown>> {
    const dueLimit = new Date();
    dueLimit.setDate(dueLimit.getDate() + INSPECTION_DUE_SOON_DAYS);

    const where: Prisma.DoorWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.operationMode ? { operationMode: query.operationMode } : {}),
      ...(query.inspectionDue ? { nextInspectionDue: { lte: dueLimit } } : {}),
      ...(query.search
        ? {
            OR: [
              { doorNumber: { contains: query.search, mode: 'insensitive' } },
              { location: { contains: query.search, mode: 'insensitive' } },
              { manufacturer: { contains: query.search, mode: 'insensitive' } },
              { model: { contains: query.search, mode: 'insensitive' } },
              { serialNumber: { contains: query.search, mode: 'insensitive' } },
              { customer: { companyName: { contains: query.search, mode: 'insensitive' } } },
              { customer: { lastName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.door.findMany({
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
          _count: { select: { inspections: true, defects: true, serviceReports: true } },
        },
        orderBy: orderBy(query, SORTABLE, { doorNumber: 'asc' }),
        skip: query.skip,
        take: query.take,
      }),
      prisma.door.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const door = await prisma.door.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, customerNumber: true, companyName: true, lastName: true } },
        site: true,
        inspections: {
          orderBy: { date: 'desc' },
          take: 10,
          select: {
            id: true,
            inspectionNumber: true,
            date: true,
            type: true,
            result: true,
            inspectorName: true,
            nextDueDate: true,
            completedAt: true,
          },
        },
        defects: { where: { status: { not: 'BEHOBEN' } }, orderBy: { severity: 'desc' } },
        serviceReports: {
          orderBy: { date: 'desc' },
          take: 10,
          select: { id: true, reportNumber: true, date: true, status: true, workPerformed: true },
        },
        contracts: { select: { id: true, contractNumber: true, title: true, status: true } },
      },
    });
    if (!door) {
      throw new NotFoundException('Die Toranlage wurde nicht gefunden.');
    }

    return {
      ...door,
      inspectionOverdue: door.nextInspectionDue ? door.nextInspectionDue < new Date() : false,
      daysUntilInspection: door.nextInspectionDue
        ? daysBetween(new Date(), door.nextInspectionDue)
        : null,
    };
  }

  /**
   * Anlagen mit anstehender oder überschrittener Prüffrist. Grundlage der
   * Terminplanung nach ASR A1.7, die eine mindestens jährliche Prüfung
   * kraftbetätigter Tore verlangt.
   */
  async inspectionsDue(withinDays = INSPECTION_DUE_SOON_DAYS): Promise<InspectionDueRow[]> {
    const limit = new Date();
    limit.setDate(limit.getDate() + withinDays);

    const doors = await prisma.door.findMany({
      where: {
        operationMode: OperationMode.KRAFTBETAETIGT,
        status: { not: 'STILLGELEGT' },
        OR: [{ nextInspectionDue: { lte: limit } }, { nextInspectionDue: null }],
      },
      include: {
        customer: { select: { id: true, companyName: true, firstName: true, lastName: true } },
        site: { select: { name: true, city: true } },
        inspections: {
          where: { completedAt: { not: null } },
          orderBy: { date: 'desc' },
          take: 1,
          select: { date: true },
        },
      },
      orderBy: [{ nextInspectionDue: 'asc' }],
    });

    const now = new Date();
    return doors.map((door) => ({
      doorId: door.id,
      doorNumber: door.doorNumber,
      customerId: door.customerId,
      customerName:
        door.customer.companyName ??
        [door.customer.firstName, door.customer.lastName].filter(Boolean).join(' '),
      siteLabel: door.site ? `${door.site.name}, ${door.site.city}` : null,
      lastInspection: door.inspections[0]?.date.toISOString() ?? null,
      nextDueDate: door.nextInspectionDue?.toISOString() ?? null,
      daysUntilDue: door.nextInspectionDue ? daysBetween(now, door.nextInspectionDue) : null,
      // Ohne hinterlegte Frist gilt die Anlage als ungeprüft und damit überfällig.
      overdue: door.nextInspectionDue ? door.nextInspectionDue < now : true,
    }));
  }

  async create(dto: CreateDoorDto) {
    await customers.assertExists(dto.customerId);
    if (dto.siteId) {
      await customers.assertSiteBelongsToCustomer(dto.siteId, dto.customerId);
    }

    const operationMode = dto.operationMode ?? OperationMode.KRAFTBETAETIGT;

    return prisma.$transaction(async (tx) => {
      const doorNumber = await numbers.next('DOOR', tx);
      return tx.door.create({
        data: {
          doorNumber,
          customerId: dto.customerId,
          siteId: dto.siteId ?? null,
          type: dto.type,
          operationMode,
          status: dto.status ?? 'IN_BETRIEB',
          location: dto.location,
          manufacturer: dto.manufacturer ?? null,
          model: dto.model ?? null,
          serialNumber: dto.serialNumber ?? null,
          yearBuilt: dto.yearBuilt ?? null,
          widthMm: dto.widthMm ?? null,
          heightMm: dto.heightMm ?? null,
          weightKg: dto.weightKg ?? null,
          driveManufacturer: dto.driveManufacturer ?? null,
          driveModel: dto.driveModel ?? null,
          driveSerialNumber: dto.driveSerialNumber ?? null,
          installationDate: dto.installationDate ? new Date(dto.installationDate) : null,
          warrantyUntil: dto.warrantyUntil ? new Date(dto.warrantyUntil) : null,
          nextInspectionDue: this.initialInspectionDue(dto, operationMode),
          notes: dto.notes ?? null,
        },
        include: { customer: true, site: true },
      });
    });
  }

  async update(id: string, dto: UpdateDoorDto) {
    const door = await prisma.door.findUnique({ where: { id } });
    if (!door) {
      throw new NotFoundException('Die Toranlage wurde nicht gefunden.');
    }
    if (dto.siteId) {
      await customers.assertSiteBelongsToCustomer(dto.siteId, dto.customerId ?? door.customerId);
    }

    return prisma.door.update({
      where: { id },
      data: {
        ...(dto.siteId === undefined ? {} : { siteId: dto.siteId }),
        ...(dto.type === undefined ? {} : { type: dto.type }),
        ...(dto.operationMode === undefined ? {} : { operationMode: dto.operationMode }),
        ...(dto.status === undefined ? {} : { status: dto.status }),
        ...(dto.location === undefined ? {} : { location: dto.location }),
        ...(dto.manufacturer === undefined ? {} : { manufacturer: dto.manufacturer }),
        ...(dto.model === undefined ? {} : { model: dto.model }),
        ...(dto.serialNumber === undefined ? {} : { serialNumber: dto.serialNumber }),
        ...(dto.yearBuilt === undefined ? {} : { yearBuilt: dto.yearBuilt }),
        ...(dto.widthMm === undefined ? {} : { widthMm: dto.widthMm }),
        ...(dto.heightMm === undefined ? {} : { heightMm: dto.heightMm }),
        ...(dto.weightKg === undefined ? {} : { weightKg: dto.weightKg }),
        ...(dto.driveManufacturer === undefined
          ? {}
          : { driveManufacturer: dto.driveManufacturer }),
        ...(dto.driveModel === undefined ? {} : { driveModel: dto.driveModel }),
        ...(dto.driveSerialNumber === undefined
          ? {}
          : { driveSerialNumber: dto.driveSerialNumber }),
        ...(dto.installationDate === undefined
          ? {}
          : { installationDate: dto.installationDate ? new Date(dto.installationDate) : null }),
        ...(dto.warrantyUntil === undefined
          ? {}
          : { warrantyUntil: dto.warrantyUntil ? new Date(dto.warrantyUntil) : null }),
        ...(dto.nextInspectionDue === undefined
          ? {}
          : { nextInspectionDue: dto.nextInspectionDue ? new Date(dto.nextInspectionDue) : null }),
        ...(dto.notes === undefined ? {} : { notes: dto.notes }),
      },
      include: { customer: true, site: true },
    });
  }

  /**
   * Anlagen mit Prüfhistorie werden stillgelegt statt gelöscht, damit die
   * Nachweise der zurückliegenden Prüfungen erhalten bleiben.
   */
  async remove(id: string) {
    const door = await prisma.door.findUnique({
      where: { id },
      include: { _count: { select: { inspections: true, serviceReports: true } } },
    });
    if (!door) {
      throw new NotFoundException('Die Toranlage wurde nicht gefunden.');
    }

    if (door._count.inspections > 0 || door._count.serviceReports > 0) {
      return prisma.door.update({
        where: { id },
        data: { status: 'STILLGELEGT', nextInspectionDue: null },
      });
    }

    await prisma.door.delete({ where: { id } });
    return { deleted: true, id };
  }

  async assertExists(id: string): Promise<void> {
    const count = await prisma.door.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException('Die Toranlage wurde nicht gefunden.');
    }
  }

  /**
   * Erste Prüffrist: handbetätigte Anlagen sind nicht prüfpflichtig, bei
   * kraftbetätigten gilt das Einbaudatum zzgl. Prüfintervall.
   */
  private initialInspectionDue(dto: CreateDoorDto, operationMode: OperationMode): Date | null {
    if (dto.nextInspectionDue) return new Date(dto.nextInspectionDue);
    if (operationMode !== OperationMode.KRAFTBETAETIGT) return null;

    const base = dto.installationDate ? new Date(dto.installationDate) : new Date();
    return addMonths(base, INSPECTION_INTERVAL_MONTHS);
  }
}

export const doors = new DoorsService();
