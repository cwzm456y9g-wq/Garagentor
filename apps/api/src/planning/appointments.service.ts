import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { endOfDay, startOfDay, type Paginated } from '@garagentor/shared';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { paginate } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AppointmentQueryDto,
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './dto/planning.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AppointmentQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.AppointmentWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.employeeId ? { assignees: { some: { id: query.employeeId } } } : {}),
      // Ein Termin fällt in den Zeitraum, wenn er ihn irgendwie berührt.
      ...(query.from ? { end: { gte: new Date(query.from) } } : {}),
      ...(query.to ? { start: { lte: new Date(query.to) } } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { location: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        include: {
          customer: { select: { id: true, companyName: true, firstName: true, lastName: true } },
          site: { select: { id: true, name: true, street: true, zip: true, city: true } },
          order: { select: { id: true, orderNumber: true, type: true } },
          assignees: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { start: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: true,
        site: true,
        order: { select: { id: true, orderNumber: true, subject: true, status: true } },
        assignees: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Der Termin wurde nicht gefunden.');
    }
    return appointment;
  }

  /** Tagesplan eines Mitarbeiters bzw. des gesamten Betriebs. */
  async daySchedule(date: string, employeeId?: string) {
    const day = new Date(date);
    if (Number.isNaN(day.getTime())) {
      throw new BadRequestException('Ungültiges Datum.');
    }

    return this.prisma.appointment.findMany({
      where: {
        start: { lte: endOfDay(day) },
        end: { gte: startOfDay(day) },
        status: { not: AppointmentStatus.ABGESAGT },
        ...(employeeId ? { assignees: { some: { id: employeeId } } } : {}),
      },
      include: {
        customer: { select: { id: true, companyName: true, firstName: true, lastName: true } },
        site: { select: { name: true, street: true, zip: true, city: true } },
        order: { select: { id: true, orderNumber: true } },
        assignees: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { start: 'asc' },
    });
  }

  /**
   * Legt einen Termin an. Doppelbelegungen werden nicht blockiert –
   * kurzfristige Umplanungen sind im Tagesgeschäft üblich –, aber als
   * `conflicts` mitgeliefert, damit die Disposition sie sieht.
   */
  async create(dto: CreateAppointmentDto) {
    const { start, end } = this.validateRange(dto.start, dto.end);

    const conflicts = dto.assigneeIds?.length
      ? await this.conflicts(dto.assigneeIds, start, end)
      : [];

    const appointment = await this.prisma.appointment.create({
      data: {
        title: dto.title,
        type: dto.type ?? 'MONTAGE',
        start,
        end,
        allDay: dto.allDay ?? false,
        customerId: dto.customerId ?? null,
        siteId: dto.siteId ?? null,
        orderId: dto.orderId ?? null,
        location: dto.location ?? null,
        description: dto.description ?? null,
        assignees: dto.assigneeIds
          ? { connect: dto.assigneeIds.map((employeeId) => ({ id: employeeId })) }
          : undefined,
      },
      include: { assignees: { select: { id: true, firstName: true, lastName: true } } },
    });

    return { ...appointment, conflicts };
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      throw new NotFoundException('Der Termin wurde nicht gefunden.');
    }

    const start = dto.start ? new Date(dto.start) : appointment.start;
    const end = dto.end ? new Date(dto.end) : appointment.end;
    if (dto.start || dto.end) {
      this.validateRange(start.toISOString(), end.toISOString());
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...(dto.title === undefined ? {} : { title: dto.title }),
        ...(dto.type === undefined ? {} : { type: dto.type }),
        ...(dto.status === undefined ? {} : { status: dto.status }),
        ...(dto.start === undefined ? {} : { start }),
        ...(dto.end === undefined ? {} : { end }),
        ...(dto.allDay === undefined ? {} : { allDay: dto.allDay }),
        ...(dto.customerId === undefined ? {} : { customerId: dto.customerId }),
        ...(dto.siteId === undefined ? {} : { siteId: dto.siteId }),
        ...(dto.orderId === undefined ? {} : { orderId: dto.orderId }),
        ...(dto.location === undefined ? {} : { location: dto.location }),
        ...(dto.description === undefined ? {} : { description: dto.description }),
        // Die Einteilung wird vollständig ersetzt, nicht ergänzt.
        ...(dto.assigneeIds === undefined
          ? {}
          : { assignees: { set: dto.assigneeIds.map((employeeId) => ({ id: employeeId })) } }),
      },
      include: { assignees: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async remove(id: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      throw new NotFoundException('Der Termin wurde nicht gefunden.');
    }

    await this.prisma.appointment.delete({ where: { id } });
    return { deleted: true, id };
  }

  /** Terminüberschneidungen eines Mitarbeiters im angegebenen Zeitraum. */
  async conflicts(employeeIds: string[], start: Date, end: Date, exceptId?: string) {
    return this.prisma.appointment.findMany({
      where: {
        id: exceptId ? { not: exceptId } : undefined,
        status: { notIn: [AppointmentStatus.ABGESAGT, AppointmentStatus.ERLEDIGT] },
        assignees: { some: { id: { in: employeeIds } } },
        start: { lt: end },
        end: { gt: start },
      },
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        assignees: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  private validateRange(startInput: string, endInput: string): { start: Date; end: Date } {
    const start = new Date(startInput);
    const end = new Date(endInput);

    if (end <= start) {
      throw new BadRequestException('Das Ende des Termins muss nach dem Beginn liegen.');
    }
    return { start, end };
  }
}
