import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser, JwtPayload, LoginResponse } from '@garagentor/shared';
import { type User } from '@prisma/client';
import * as argon2 from 'argon2';
import { loadConfiguration } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import type { ChangePasswordDto, LoginDto } from './dto/auth.dto';

/** Kontext des anfragenden Geräts, wird am Refresh-Token vermerkt. */
export interface ClientContext {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly config = loadConfiguration();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto, client: ClientContext = {}): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Auch bei unbekannter Adresse wird verifiziert, damit die Antwortzeit
    // keinen Rückschluss auf die Existenz des Kontos zulässt.
    const hash = user?.passwordHash ?? (await this.dummyHash());
    const valid = await this.verify(hash, dto.password);

    if (!user || !valid) {
      throw new UnauthorizedException('E-Mail-Adresse oder Passwort ist falsch.');
    }
    if (!user.active) {
      throw new ForbiddenException('Das Benutzerkonto ist deaktiviert.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(user, client);
  }

  /**
   * Tauscht einen Refresh-Token gegen ein neues Tokenpaar. Der alte Token wird
   * dabei entwertet (Rotation). Wird ein bereits entwerteter Token erneut
   * vorgelegt, deutet das auf Diebstahl hin – dann werden alle Sitzungen des
   * Benutzers beendet.
   */
  async refresh(refreshToken: string, client: ClientContext = {}): Promise<LoginResponse> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.jwt.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Der Refresh-Token ist ungültig oder abgelaufen.');
    }

    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Es wurde kein Refresh-Token übergeben.');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
    });

    if (!stored) {
      throw new UnauthorizedException('Der Refresh-Token ist unbekannt.');
    }

    if (stored.revokedAt) {
      this.logger.warn(
        `Bereits entwerteter Refresh-Token für Benutzer ${stored.userId} vorgelegt – ` +
          'alle Sitzungen werden beendet.',
      );
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Die Sitzung wurde aus Sicherheitsgründen beendet.');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Die Sitzung ist abgelaufen. Bitte erneut anmelden.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.active) {
      throw new ForbiddenException('Das Benutzerkonto ist deaktiviert.');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user, client);
  }

  /** Beendet die übergebene Sitzung; ein unbekannter Token bleibt folgenlos. */
  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Benutzer nicht gefunden.');
    }

    if (!(await this.verify(user.passwordHash, dto.currentPassword))) {
      throw new BadRequestException('Das aktuelle Passwort ist falsch.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Das neue Passwort muss sich vom bisherigen unterscheiden.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.hashPassword(dto.newPassword) },
    });

    // Nach einer Passwortänderung müssen sich alle Geräte neu anmelden.
    await this.revokeAllForUser(userId);
    return { success: true };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Benutzer nicht gefunden.');
    }
    return this.toAuthUser(user);
  }

  hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Entfernt abgelaufene und entwertete Tokens; wird täglich aufgerufen. */
  async purgeExpiredTokens(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: cutoff } }],
      },
    });
    return result.count;
  }

  toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      employeeId: user.employeeId,
    };
  }

  private async issueTokens(user: User, client: ClientContext): Promise<LoginResponse> {
    const basePayload = { sub: user.id, email: user.email, role: user.role };

    // Laufzeiten werden in Sekunden übergeben, damit die Konfiguration sowohl
    // `15m` als auch `900` akzeptieren kann.
    const accessTtl = this.ttlToSeconds(this.config.jwt.accessTtl);

    const accessToken = await this.jwt.signAsync(
      { ...basePayload, typ: 'access' },
      { secret: this.config.jwt.accessSecret, expiresIn: accessTtl },
    );

    // Ein Zufallsanteil stellt sicher, dass zwei Tokens derselben Sekunde
    // unterschiedliche Hashes ergeben.
    const refreshToken = await this.jwt.signAsync(
      { ...basePayload, typ: 'refresh', jti: randomBytes(16).toString('hex') },
      {
        secret: this.config.jwt.refreshSecret,
        expiresIn: this.ttlToSeconds(this.config.jwt.refreshTtl),
      },
    );

    const decoded = this.jwt.decode<{ exp: number }>(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(decoded.exp * 1000),
        userAgent: client.userAgent?.slice(0, 255),
        ipAddress: client.ipAddress,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTtl,
      user: this.toAuthUser(user),
    };
  }

  /** Nur der Hash des Tokens wird gespeichert, nie der Token selbst. */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  private dummyHash(): Promise<string> {
    return argon2.hash(randomBytes(24).toString('hex'), { type: argon2.argon2id });
  }

  /** Wandelt Angaben wie `15m`, `7d` oder `900` in Sekunden um. */
  private ttlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])?$/.exec(ttl.trim());
    if (!match) return 900;

    const value = Number.parseInt(match[1], 10);
    switch (match[2]) {
      case 'd':
        return value * 86_400;
      case 'h':
        return value * 3_600;
      case 'm':
        return value * 60;
      default:
        return value;
    }
  }
}
