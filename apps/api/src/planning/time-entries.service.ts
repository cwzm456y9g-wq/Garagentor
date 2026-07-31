import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { durationHours, endOfDay, round, startOfDay, type Paginated } from '@garagentor/shared';
import { Prisma, Role, TimeEntryType, type Employee } from '@prisma/client';
import type { AuthUser } from '@garagentor/shared';
import { paginate } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTimeEntryDto, TimeEntryQueryDto, UpdateTimeEntryDto } from './dto/planning.dto';

/** Arbeitszeiten, die auf das Arbeitszeitkonto einzahlen. */
const WORKING_TYPES: TimeEntryType[] = [
  TimeEntryType.ARBEITSZEIT,
  TimeEntryType.FAHRTZEIT,
  TimeEntryType.BEREITSCHAFT,
  TimeEntryType.SCHULUNG,
];

/** Höchstarbeitszeit je Tag nach § 3 ArbZG (Ausnahme bis 10 Stunden). */
const MAX_DAILY_HOURS = 10;

@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: TimeEntryQueryDto, user: AuthUser): Promise<Paginated<unknown>> {
    const where: Prisma.TimeEntryWhereInput = {
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.billableOnly ? { billable: true } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: startOfDay(query.from) } : {}),
              ...(query.to ? { lte: endOfDay(query.to) } : {}),
            },
          }
        : {}),
    };

    // Monteure sehen ausschließlich die eigenen Zeiten.
    if (user.role === Role.MONTEUR) {
      where.employeeId = user.employeeId ?? '__ohne_mitarbeiter__';
    }

    const [items, total, sum] = await this.prisma.$transaction([
      this.prisma.timeEntry.findMany({
        where,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
          order: { select: { id: true, orderNumber: true, subject: true } },
          project: { select: { id: true, projectNumber: true, name: true } },
        },
        orderBy: [{ date: 'desc' }, { start: 'desc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.timeEntry.count({ where }),
      this.prisma.timeEntry.aggregate({ where, _sum: { hours: true } }),
    ]);

    return {
      ...paginate(items, total, query),
      // Gesamtstunden über alle Seiten des aktuellen Filters.
      summeStunden: round(sum._sum.hours?.toNumber() ?? 0),
    } as Paginated<unknown> & { summeStunden: number };
  }

  async findOne(id: string, user: AuthUser) {
    const entry = await this.prisma.timeEntry.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        order: { select: { id: true, orderNumber: true, subject: true } },
        project: { select: { id: true, projectNumber: true, name: true } },
      },
    });
    if (!entry) {
      throw new NotFoundException('Der Zeiteintrag wurde nicht gefunden.');
    }
    this.assertMayAccess(entry.employeeId, user);
    return entry;
  }

  async create(dto: CreateTimeEntryDto, user: AuthUser) {
    const employeeId = await this.resolveEmployee(dto.employeeId, user);

    const start = new Date(dto.start);
    const end = new Date(dto.end);
    if (end <= start) {
      throw new BadRequestException('Das Ende muss nach dem Beginn liegen.');
    }

    const breakMinutes = dto.breakMinutes ?? 0;
    const hours = durationHours(start, end, breakMinutes);
    if (hours <= 0) {
      throw new BadRequestException('Die Pause ist länger als der erfasste Zeitraum.');
    }

    const date = startOfDay(start);
    await this.assertNoOverlap(employeeId, start, end);
    await this.assertDailyLimit(employeeId, date, dto.type ?? TimeEntryType.ARBEITSZEIT, hours);

    return this.prisma.timeEntry.create({
      data: {
        employeeId,
        type: dto.type ?? TimeEntryType.ARBEITSZEIT,
        date,
        start,
        end,
        breakMinutes,
        hours,
        orderId: dto.orderId ?? null,
        projectId: dto.projectId ?? null,
        billable: dto.billable ?? true,
        description: dto.description ?? null,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        order: { select: { id: true, orderNumber: true } },
      },
    });
  }

  async update(id: string, dto: UpdateTimeEntryDto, user: AuthUser) {
    const entry = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundException('Der Zeiteintrag wurde nicht gefunden.');
    }
    this.assertMayAccess(entry.employeeId, user);

    if (entry.invoiced) {
      throw new ConflictException(
        'Der Zeiteintrag wurde bereits abgerechnet und kann nicht geändert werden.',
      );
    }

    const start = dto.start ? new Date(dto.start) : entry.start;
    const end = dto.end ? new Date(dto.end) : entry.end;
    if (end <= start) {
      throw new BadRequestException('Das Ende muss nach dem Beginn liegen.');
    }

    const breakMinutes = dto.breakMinutes ?? entry.breakMinutes;
    const hours = durationHours(start, end, breakMinutes);
    if (hours <= 0) {
      throw new BadRequestException('Die Pause ist länger als der erfasste Zeitraum.');
    }

    if (dto.start || dto.end) {
      await this.assertNoOverlap(entry.employeeId, start, end, id);
    }

    return this.prisma.timeEntry.update({
      where: { id },
      data: {
        ...(dto.type === undefined ? {} : { type: dto.type }),
        date: startOfDay(start),
        start,
        end,
        breakMinutes,
        hours,
        ...(dto.orderId === undefined ? {} : { orderId: dto.orderId }),
        ...(dto.projectId === undefined ? {} : { projectId: dto.projectId }),
        ...(dto.billable === undefined ? {} : { billable: dto.billable }),
        ...(dto.description === undefined ? {} : { description: dto.description }),
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async remove(id: string, user: AuthUser) {
    const entry = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundException('Der Zeiteintrag wurde nicht gefunden.');
    }
    this.assertMayAccess(entry.employeeId, user);

    if (entry.invoiced) {
      throw new ConflictException('Abgerechnete Zeiteinträge können nicht gelöscht werden.');
    }

    await this.prisma.timeEntry.delete({ where: { id } });
    return { deleted: true, id };
  }

  /** Wochenübersicht eines Mitarbeiters mit Tagessummen. */
  async weekSummary(employeeId: string, from: string, user: AuthUser) {
    this.assertMayAccess(employeeId, user);

    const start = startOfDay(from);
    const end = endOfDay(new Date(start.getTime() + 6 * 86_400_000));

    const entries = await this.prisma.timeEntry.findMany({
      where: { employeeId, date: { gte: start, lte: end } },
      include: { order: { select: { orderNumber: true, subject: true } } },
      orderBy: [{ date: 'asc' }, { start: 'asc' }],
    });

    const byDay = new Map<string, { datum: string; stunden: number; eintraege: unknown[] }>();
    for (const entry of entries) {
      const key = entry.date.toISOString().slice(0, 10);
      const day = byDay.get(key) ?? { datum: key, stunden: 0, eintraege: [] };
      day.stunden = round(day.stunden + entry.hours.toNumber());
      day.eintraege.push(entry);
      byDay.set(key, day);
    }

    const total = round(entries.reduce((sum, entry) => sum + entry.hours.toNumber(), 0));
    const billable = round(
      entries
        .filter((entry) => entry.billable)
        .reduce((sum, entry) => sum + entry.hours.toNumber(), 0),
    );

    return {
      von: start.toISOString().slice(0, 10),
      bis: end.toISOString().slice(0, 10),
      summeStunden: total,
      abrechenbareStunden: billable,
      tage: [...byDay.values()],
    };
  }

  /* Interna ------------------------------------------------------------ */

  /** Monteure erfassen nur eigene Zeiten. */
  private assertMayAccess(employeeId: string, user: AuthUser): void {
    if (user.role !== Role.MONTEUR) return;
    if (user.employeeId && user.employeeId === employeeId) return;

    throw new ForbiddenException('Es können nur die eigenen Zeiten eingesehen werden.');
  }

  private async resolveEmployee(employeeId: string | undefined, user: AuthUser): Promise<string> {
    const target = employeeId ?? user.employeeId;
    if (!target) {
      throw new BadRequestException(
        'Dem Benutzerkonto ist kein Mitarbeiter zugeordnet. Bitte den Mitarbeiter angeben.',
      );
    }
    this.assertMayAccess(target, user);

    const employee: Employee | null = await this.prisma.employee.findUnique({
      where: { id: target },
    });
    if (!employee) {
      throw new NotFoundException('Der Mitarbeiter wurde nicht gefunden.');
    }
    return target;
  }

  /** Ein Mitarbeiter kann nicht zeitgleich zwei Tätigkeiten erfassen. */
  private async assertNoOverlap(
    employeeId: string,
    start: Date,
    end: Date,
    exceptId?: string,
  ): Promise<void> {
    const overlap = await this.prisma.timeEntry.findFirst({
      where: {
        employeeId,
        id: exceptId ? { not: exceptId } : undefined,
        start: { lt: end },
        end: { gt: start },
      },
    });

    if (overlap) {
      throw new ConflictException(
        `Für diesen Zeitraum ist bereits eine Zeit von ` +
          `${overlap.start.toISOString().slice(11, 16)} bis ` +
          `${overlap.end.toISOString().slice(11, 16)} erfasst.`,
      );
    }
  }

  /** Warnt, wenn die Höchstarbeitszeit nach § 3 ArbZG überschritten würde. */
  private async assertDailyLimit(
    employeeId: string,
    date: Date,
    type: TimeEntryType,
    hours: number,
  ): Promise<void> {
    if (!WORKING_TYPES.includes(type)) return;

    const existing = await this.prisma.timeEntry.aggregate({
      where: { employeeId, date, type: { in: WORKING_TYPES } },
      _sum: { hours: true },
    });

    const total = round((existing._sum.hours?.toNumber() ?? 0) + hours);
    if (total > MAX_DAILY_HOURS) {
      throw new BadRequestException(
        `Die Tagesarbeitszeit läge bei ${total} Stunden und überschreitet die zulässigen ` +
          `${MAX_DAILY_HOURS} Stunden nach § 3 ArbZG.`,
      );
    }
  }
}
