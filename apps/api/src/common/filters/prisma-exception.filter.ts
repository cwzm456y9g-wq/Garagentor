import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Übersetzt Prisma-Fehler in aussagekräftige HTTP-Antworten, damit keine
 * internen Datenbankdetails nach außen gelangen.
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Datenbankfehler';

    if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Ungültige Anfrage an die Datenbank';
    } else {
      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          const target = exception.meta?.target;
          const fields = Array.isArray(target) ? target.join(', ') : String(target ?? 'Feld');
          message = `Es existiert bereits ein Datensatz mit diesem Wert (${fields}).`;
          break;
        }
        case 'P2003':
          status = HttpStatus.CONFLICT;
          message = 'Der Datensatz ist noch mit anderen Datensätzen verknüpft.';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Der Datensatz wurde nicht gefunden.';
          break;
        case 'P2014':
          status = HttpStatus.CONFLICT;
          message = 'Die Änderung verletzt eine bestehende Beziehung.';
          break;
        default:
          this.logger.error(`Unbehandelter Prisma-Fehler ${exception.code}`, exception.message);
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status],
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
