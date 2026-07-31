import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@garagentor/shared';
import type { Role } from '@prisma/client';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Hebt die globale Authentifizierungspflicht für einen Endpunkt auf. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Beschränkt einen Endpunkt auf die angegebenen Rollen. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Liefert den angemeldeten Benutzer, optional nur ein einzelnes Feld. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
