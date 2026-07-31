import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@garagentor/shared';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/auth.decorators';

/**
 * Wertet @Roles() aus. Administratoren haben grundsätzlich Zugriff, damit die
 * Rollenlisten der einzelnen Endpunkte übersichtlich bleiben.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) return false;

    if (user.role === Role.ADMIN || required.includes(user.role)) return true;

    throw new ForbiddenException('Für diese Aktion fehlt die erforderliche Berechtigung.');
  }
}
