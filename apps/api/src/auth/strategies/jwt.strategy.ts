import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { AuthUser, JwtPayload } from '@garagentor/shared';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { loadConfiguration } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Prüft den Access-Token und lädt den Benutzer frisch aus der Datenbank,
 * damit Rollenänderungen und Sperrungen sofort greifen.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: loadConfiguration().jwt.accessSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Es wurde kein Access-Token übergeben.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) {
      throw new UnauthorizedException('Das Benutzerkonto ist nicht mehr gültig.');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      employeeId: user.employeeId,
    };
  }
}
