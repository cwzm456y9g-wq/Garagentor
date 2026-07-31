import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, map } from 'rxjs';

/**
 * Prisma liefert Decimal-Spalten als `Prisma.Decimal`, das sich in JSON als
 * String darstellt. Damit Frontend und Backend dieselben Rechenhelfer aus
 * @garagentor/shared nutzen können, werden alle Decimal-Werte hier in Zahlen
 * umgewandelt. Datumsangaben bleiben unverändert und werden von der
 * JSON-Serialisierung als ISO-String ausgegeben.
 */
@Injectable()
export class DecimalInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => convert(data)));
  }
}

function convert(value: unknown, depth = 0): unknown {
  // Schutz vor zyklischen oder ungewöhnlich tiefen Strukturen.
  if (depth > 12 || value === null || value === undefined) return value;

  if (Prisma.Decimal.isDecimal(value)) {
    return (value as Prisma.Decimal).toNumber();
  }

  if (value instanceof Date || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((entry) => convert(entry, depth + 1));
  }

  if (Buffer.isBuffer(value)) return value;

  // Nur einfache Objekte umbauen, keine Klasseninstanzen wie Streams.
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = convert(entry, depth + 1);
  }
  return result;
}
