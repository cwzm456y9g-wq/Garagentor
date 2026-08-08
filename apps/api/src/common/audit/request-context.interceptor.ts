import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { AuthUser } from '@garagentor/shared';
import { Observable } from 'rxjs';
import { runWithRequestContext } from './request-context';

/**
 * Legt den angemeldeten Benutzer für die Dauer der Anfrage ab. Läuft als
 * Interceptor und damit nach den Guards – vorher steht `request.user` noch
 * nicht fest.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    return runWithRequestContext({ userId: request?.user?.id }, () => next.handle());
  }
}
