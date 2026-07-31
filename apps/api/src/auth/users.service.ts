import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Paginated } from '@garagentor/shared';
import { Prisma, Role, type User } from '@prisma/client';
import { orderBy, paginate, type PaginationQueryDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { CreateUserDto, UpdateUserDto } from './dto/auth.dto';

/** Benutzerdatensatz ohne Passwort-Hash. */
export type SafeUser = Omit<User, 'passwordHash'>;

const SORTABLE = ['email', 'lastName', 'role', 'createdAt', 'lastLoginAt'] as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async findAll(query: PaginationQueryDto): Promise<Paginated<SafeUser>> {
    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: 'insensitive' } },
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        omit: { passwordHash: true },
        include: { employee: { select: { id: true, employeeNumber: true } } },
        orderBy: orderBy(query, SORTABLE, { lastName: 'asc' }),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      omit: { passwordHash: true },
      include: { employee: { select: { id: true, employeeNumber: true } } },
    });
    if (!user) {
      throw new NotFoundException('Der Benutzer wurde nicht gefunden.');
    }
    return user;
  }

  async create(dto: CreateUserDto): Promise<SafeUser> {
    if (dto.employeeId) {
      await this.assertEmployeeAvailable(dto.employeeId);
    }

    return this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        employeeId: dto.employeeId ?? null,
        passwordHash: await this.auth.hashPassword(dto.password),
      },
      omit: { passwordHash: true },
    });
  }

  async update(id: string, dto: UpdateUserDto, actingUserId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Der Benutzer wurde nicht gefunden.');
    }

    // Ein Administrator darf sich nicht selbst aussperren oder herabstufen.
    if (id === actingUserId) {
      if (dto.active === false) {
        throw new BadRequestException('Das eigene Konto kann nicht deaktiviert werden.');
      }
      if (dto.role && dto.role !== user.role) {
        throw new BadRequestException('Die eigene Rolle kann nicht geändert werden.');
      }
    }

    if (dto.employeeId) {
      await this.assertEmployeeAvailable(dto.employeeId, id);
    }
    if ((dto.role && dto.role !== Role.ADMIN) || dto.active === false) {
      await this.assertNotLastAdmin(user);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        active: dto.active,
        employeeId: dto.employeeId === undefined ? undefined : dto.employeeId,
      },
      omit: { passwordHash: true },
    });

    // Entzogene Rechte müssen sofort wirken, nicht erst nach Tokenablauf.
    if (dto.active === false || (dto.role && dto.role !== user.role)) {
      await this.auth.revokeAllForUser(id);
    }

    return updated;
  }

  async resetPassword(id: string, newPassword: string): Promise<{ success: true }> {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await this.auth.hashPassword(newPassword) },
    });
    await this.auth.revokeAllForUser(id);
    return { success: true };
  }

  /** Deaktiviert das Konto; Benutzer werden nicht gelöscht, um Belege zu erhalten. */
  async deactivate(id: string, actingUserId: string): Promise<SafeUser> {
    if (id === actingUserId) {
      throw new BadRequestException('Das eigene Konto kann nicht deaktiviert werden.');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Der Benutzer wurde nicht gefunden.');
    }
    await this.assertNotLastAdmin(user);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { active: false },
      omit: { passwordHash: true },
    });
    await this.auth.revokeAllForUser(id);
    return updated;
  }

  private async assertEmployeeAvailable(employeeId: string, exceptUserId?: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { id: true } } },
    });
    if (!employee) {
      throw new BadRequestException('Der angegebene Mitarbeiter existiert nicht.');
    }
    if (employee.user && employee.user.id !== exceptUserId) {
      throw new BadRequestException('Dem Mitarbeiter ist bereits ein Benutzerkonto zugeordnet.');
    }
  }

  /** Verhindert, dass der letzte aktive Administrator entfernt wird. */
  private async assertNotLastAdmin(user: User): Promise<void> {
    if (user.role !== Role.ADMIN) return;

    const admins = await this.prisma.user.count({
      where: { role: Role.ADMIN, active: true, id: { not: user.id } },
    });
    if (admins === 0) {
      throw new BadRequestException(
        'Es muss mindestens ein aktives Administratorkonto erhalten bleiben.',
      );
    }
  }
}
