import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser, Paginated } from '@garagentor/shared';
import { addDays, daysBetween, endOfDay, round, startOfDay, startOfYear } from '@garagentor/shared';
import { AbsenceStatus, AbsenceType, Prisma, Role } from '@prisma/client';
import { orderBy, paginate } from '../common/dto/pagination.dto';
import { NumberRangeService } from '../common/numbering/number-range.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AbsenceQueryDto,
  CreateAbsenceDto,
  CreateEmployeeDto,
  CreateQualificationDto,
  DecideAbsenceDto,
  EmployeeQueryDto,
  UpdateAbsenceDto,
  UpdateEmployeeDto,
  UpdateQualificationDto,
} from './dto/hr.dto';

const SORTABLE = ['employeeNumber', 'lastName', 'hireDate', 'position'] as const;

/** Abwesenheitsarten, die auf den Urlaubsanspruch angerechnet werden. */
const VACATION_TYPES: AbsenceType[] = [AbsenceType.URLAUB];

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: NumberRangeService,
  ) {}

  /* Mitarbeiter -------------------------------------------------------- */

  async findAll(query: EmployeeQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.EmployeeWhereInput = {
      ...(query.employmentType ? { employmentType: query.employmentType } : {}),
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.qualifiedInspectorsOnly
        ? {
            qualifications: {
              some: {
                qualifiesForInspection: true,
                OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
              },
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { employeeNumber: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { position: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, role: true } },
          qualifications: {
            where: { qualifiesForInspection: true },
            select: { id: true, name: true, expiresAt: true },
          },
        },
        orderBy: orderBy(query, SORTABLE, { lastName: 'asc' }),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, role: true, active: true } },
        qualifications: { orderBy: { expiresAt: 'asc' } },
        absences: { orderBy: { from: 'desc' }, take: 20 },
      },
    });
    if (!employee) {
      throw new NotFoundException('Der Mitarbeiter wurde nicht gefunden.');
    }

    const now = new Date();
    return {
      ...employee,
      qualifications: employee.qualifications.map((qualification) => ({
        ...qualification,
        expired: qualification.expiresAt ? qualification.expiresAt < now : false,
        daysUntilExpiry: qualification.expiresAt ? daysBetween(now, qualification.expiresAt) : null,
      })),
      urlaubskonto: await this.vacationBalance(id, now.getFullYear()),
    };
  }

  /** Urlaubsanspruch, genommene und beantragte Tage eines Jahres. */
  async vacationBalance(employeeId: string, year: number) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException('Der Mitarbeiter wurde nicht gefunden.');
    }

    const from = startOfYear(new Date(year, 0, 1));
    const to = endOfDay(new Date(year, 11, 31));

    const absences = await this.prisma.absence.findMany({
      where: {
        employeeId,
        type: { in: VACATION_TYPES },
        status: { in: [AbsenceStatus.GENEHMIGT, AbsenceStatus.BEANTRAGT] },
        from: { gte: from, lte: to },
      },
    });

    const genommen = round(
      absences
        .filter((absence) => absence.status === AbsenceStatus.GENEHMIGT)
        .reduce((sum, absence) => sum + absence.days.toNumber(), 0),
    );
    const beantragt = round(
      absences
        .filter((absence) => absence.status === AbsenceStatus.BEANTRAGT)
        .reduce((sum, absence) => sum + absence.days.toNumber(), 0),
    );

    return {
      jahr: year,
      anspruch: employee.vacationDays,
      genommen,
      beantragt,
      rest: round(employee.vacationDays - genommen - beantragt),
    };
  }

  /** Qualifikationen, die bald ablaufen oder abgelaufen sind. */
  async expiringQualifications(withinDays = 90) {
    const limit = addDays(new Date(), withinDays);

    const qualifications = await this.prisma.qualification.findMany({
      where: { expiresAt: { not: null, lte: limit }, employee: { active: true } },
      include: {
        employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
      },
      orderBy: { expiresAt: 'asc' },
    });

    const now = new Date();
    return qualifications.map((qualification) => ({
      ...qualification,
      expired: qualification.expiresAt! < now,
      daysUntilExpiry: daysBetween(now, qualification.expiresAt!),
    }));
  }

  async create(dto: CreateEmployeeDto) {
    return this.prisma.$transaction(async (tx) => {
      const employeeNumber = await this.numbers.next('EMPLOYEE', tx);
      return tx.employee.create({
        data: {
          employeeNumber,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          mobile: dto.mobile ?? null,
          position: dto.position ?? null,
          employmentType: dto.employmentType ?? 'VOLLZEIT',
          hireDate: new Date(dto.hireDate),
          exitDate: dto.exitDate ? new Date(dto.exitDate) : null,
          weeklyHours: dto.weeklyHours ?? 40,
          hourlyCost: dto.hourlyCost ?? null,
          hourlyRate: dto.hourlyRate ?? null,
          vacationDays: dto.vacationDays ?? 30,
          street: dto.street ?? null,
          zip: dto.zip ?? null,
          city: dto.city ?? null,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
          notes: dto.notes ?? null,
        },
      });
    });
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.assertExists(id);

    return this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.firstName === undefined ? {} : { firstName: dto.firstName }),
        ...(dto.lastName === undefined ? {} : { lastName: dto.lastName }),
        ...(dto.email === undefined ? {} : { email: dto.email }),
        ...(dto.phone === undefined ? {} : { phone: dto.phone }),
        ...(dto.mobile === undefined ? {} : { mobile: dto.mobile }),
        ...(dto.position === undefined ? {} : { position: dto.position }),
        ...(dto.employmentType === undefined ? {} : { employmentType: dto.employmentType }),
        ...(dto.hireDate === undefined ? {} : { hireDate: new Date(dto.hireDate) }),
        ...(dto.exitDate === undefined
          ? {}
          : { exitDate: dto.exitDate ? new Date(dto.exitDate) : null }),
        ...(dto.weeklyHours === undefined ? {} : { weeklyHours: dto.weeklyHours }),
        ...(dto.hourlyCost === undefined ? {} : { hourlyCost: dto.hourlyCost }),
        ...(dto.hourlyRate === undefined ? {} : { hourlyRate: dto.hourlyRate }),
        ...(dto.vacationDays === undefined ? {} : { vacationDays: dto.vacationDays }),
        ...(dto.street === undefined ? {} : { street: dto.street }),
        ...(dto.zip === undefined ? {} : { zip: dto.zip }),
        ...(dto.city === undefined ? {} : { city: dto.city }),
        ...(dto.birthDate === undefined
          ? {}
          : { birthDate: dto.birthDate ? new Date(dto.birthDate) : null }),
        ...(dto.notes === undefined ? {} : { notes: dto.notes }),
        ...(dto.active === undefined ? {} : { active: dto.active }),
      },
    });
  }

  /** Mitarbeiter mit Historie werden deaktiviert statt gelöscht. */
  async remove(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        _count: { select: { timeEntries: true, inspections: true, serviceReports: true } },
      },
    });
    if (!employee) {
      throw new NotFoundException('Der Mitarbeiter wurde nicht gefunden.');
    }

    const { timeEntries, inspections, serviceReports } = employee._count;
    if (timeEntries + inspections + serviceReports > 0) {
      return this.prisma.employee.update({
        where: { id },
        data: { active: false, exitDate: employee.exitDate ?? new Date() },
      });
    }

    await this.prisma.employee.delete({ where: { id } });
    return { deleted: true, id };
  }

  /* Qualifikationen ---------------------------------------------------- */

  async addQualification(employeeId: string, dto: CreateQualificationDto) {
    await this.assertExists(employeeId);

    return this.prisma.qualification.create({
      data: {
        employeeId,
        name: dto.name,
        issuer: dto.issuer ?? null,
        certificate: dto.certificate ?? null,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        qualifiesForInspection: dto.qualifiesForInspection ?? false,
        notes: dto.notes ?? null,
      },
    });
  }

  async updateQualification(employeeId: string, id: string, dto: UpdateQualificationDto) {
    const qualification = await this.prisma.qualification.findFirst({ where: { id, employeeId } });
    if (!qualification) {
      throw new NotFoundException('Die Qualifikation wurde nicht gefunden.');
    }

    return this.prisma.qualification.update({
      where: { id },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.issuer === undefined ? {} : { issuer: dto.issuer }),
        ...(dto.certificate === undefined ? {} : { certificate: dto.certificate }),
        ...(dto.issuedAt === undefined
          ? {}
          : { issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null }),
        ...(dto.expiresAt === undefined
          ? {}
          : { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }),
        ...(dto.qualifiesForInspection === undefined
          ? {}
          : { qualifiesForInspection: dto.qualifiesForInspection }),
        ...(dto.notes === undefined ? {} : { notes: dto.notes }),
      },
    });
  }

  async removeQualification(employeeId: string, id: string) {
    const result = await this.prisma.qualification.deleteMany({ where: { id, employeeId } });
    if (result.count === 0) {
      throw new NotFoundException('Die Qualifikation wurde nicht gefunden.');
    }
    return { deleted: true, id };
  }

  /* Abwesenheiten ------------------------------------------------------ */

  async findAbsences(query: AbsenceQueryDto, user: AuthUser): Promise<Paginated<unknown>> {
    const where: Prisma.AbsenceWhereInput = {
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from ? { to: { gte: startOfDay(query.from) } } : {}),
      ...(query.to ? { from: { lte: endOfDay(query.to) } } : {}),
    };

    // Monteure sehen ausschließlich die eigenen Anträge.
    if (user.role === Role.MONTEUR) {
      where.employeeId = user.employeeId ?? '__ohne_mitarbeiter__';
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.absence.findMany({
        where,
        include: {
          employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
          approver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { from: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.absence.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async createAbsence(dto: CreateAbsenceDto, user: AuthUser) {
    const employeeId = dto.employeeId ?? user.employeeId;
    if (!employeeId) {
      throw new BadRequestException(
        'Dem Benutzerkonto ist kein Mitarbeiter zugeordnet. Bitte den Mitarbeiter angeben.',
      );
    }
    if (user.role === Role.MONTEUR && employeeId !== user.employeeId) {
      throw new ForbiddenException('Es können nur eigene Abwesenheiten beantragt werden.');
    }
    await this.assertExists(employeeId);

    const from = startOfDay(dto.from);
    const to = endOfDay(dto.to);
    if (to < from) {
      throw new BadRequestException('Das Enddatum darf nicht vor dem Startdatum liegen.');
    }

    const overlap = await this.prisma.absence.findFirst({
      where: {
        employeeId,
        status: { in: [AbsenceStatus.BEANTRAGT, AbsenceStatus.GENEHMIGT] },
        from: { lte: to },
        to: { gte: from },
      },
    });
    if (overlap) {
      throw new ConflictException('Für diesen Zeitraum liegt bereits eine Abwesenheit vor.');
    }

    const days = dto.days ?? this.workingDays(from, to);

    return this.prisma.absence.create({
      data: {
        employeeId,
        type: dto.type,
        from,
        to,
        days,
        reason: dto.reason ?? null,
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async updateAbsence(id: string, dto: UpdateAbsenceDto, user: AuthUser) {
    const absence = await this.prisma.absence.findUnique({ where: { id } });
    if (!absence) {
      throw new NotFoundException('Die Abwesenheit wurde nicht gefunden.');
    }
    if (user.role === Role.MONTEUR && absence.employeeId !== user.employeeId) {
      throw new ForbiddenException('Es können nur eigene Abwesenheiten geändert werden.');
    }
    if (absence.status !== AbsenceStatus.BEANTRAGT) {
      throw new ConflictException('Nur beantragte Abwesenheiten können geändert werden.');
    }

    const from = dto.from ? startOfDay(dto.from) : absence.from;
    const to = dto.to ? endOfDay(dto.to) : absence.to;
    if (to < from) {
      throw new BadRequestException('Das Enddatum darf nicht vor dem Startdatum liegen.');
    }

    return this.prisma.absence.update({
      where: { id },
      data: {
        ...(dto.type === undefined ? {} : { type: dto.type }),
        from,
        to,
        days: dto.days ?? (dto.from || dto.to ? this.workingDays(from, to) : absence.days),
        ...(dto.reason === undefined ? {} : { reason: dto.reason }),
      },
    });
  }

  /** Genehmigt oder lehnt einen Antrag ab. */
  async decideAbsence(id: string, dto: DecideAbsenceDto, user: AuthUser) {
    const absence = await this.prisma.absence.findUnique({ where: { id } });
    if (!absence) {
      throw new NotFoundException('Die Abwesenheit wurde nicht gefunden.');
    }
    if (absence.status !== AbsenceStatus.BEANTRAGT) {
      throw new ConflictException('Über den Antrag wurde bereits entschieden.');
    }
    if (dto.status !== AbsenceStatus.GENEHMIGT && dto.status !== AbsenceStatus.ABGELEHNT) {
      throw new BadRequestException('Zulässig sind nur GENEHMIGT und ABGELEHNT.');
    }
    // Der eigene Antrag darf nicht selbst genehmigt werden.
    if (absence.employeeId === user.employeeId) {
      throw new ForbiddenException('Eigene Anträge können nicht selbst genehmigt werden.');
    }

    return this.prisma.absence.update({
      where: { id },
      data: {
        status: dto.status,
        approverId: user.employeeId ?? null,
        approvedAt: new Date(),
        reason: dto.reason ?? absence.reason,
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async cancelAbsence(id: string, user: AuthUser) {
    const absence = await this.prisma.absence.findUnique({ where: { id } });
    if (!absence) {
      throw new NotFoundException('Die Abwesenheit wurde nicht gefunden.');
    }
    if (user.role === Role.MONTEUR && absence.employeeId !== user.employeeId) {
      throw new ForbiddenException('Es können nur eigene Abwesenheiten storniert werden.');
    }

    return this.prisma.absence.update({
      where: { id },
      data: { status: AbsenceStatus.STORNIERT },
    });
  }

  async assertExists(id: string): Promise<void> {
    const count = await this.prisma.employee.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException('Der Mitarbeiter wurde nicht gefunden.');
    }
  }

  /**
   * Werktage (Montag bis Freitag) im Zeitraum. Gesetzliche Feiertage werden
   * nicht berücksichtigt – sie lassen sich beim Antrag über `days` abziehen.
   */
  private workingDays(from: Date, to: Date): number {
    let days = 0;
    const cursor = startOfDay(from);
    const last = startOfDay(to);

    while (cursor <= last) {
      const weekday = cursor.getDay();
      if (weekday !== 0 && weekday !== 6) days += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }
}
