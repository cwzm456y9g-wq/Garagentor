import { HttpFehler } from './fehler';

/**
 * Ersatz für die Bausteine, die die Fachlogik aus `@nestjs/common` bezogen hat.
 *
 * Die Dienste enthalten rund 200 Stellen, an denen eine dieser Ausnahmen
 * geworfen wird – Mahnfristen, Bestandsprüfungen, Nummernkreise. Diese Zeilen
 * sind getestet und tragen fachliche Entscheidungen. Sie umzuschreiben hieße,
 * 17.000 Zeilen Buchhaltungslogik anzufassen, um nichts zu gewinnen.
 *
 * Stattdessen behalten die Ausnahmen ihren Namen und ihre Bedeutung und werden
 * hier auf den gemeinsamen `HttpFehler` zurückgeführt, den die Fehlerbehandlung
 * der Route Handler ohnehin versteht.
 */
export class NotFoundException extends HttpFehler {
  constructor(nachricht = 'Der Datensatz wurde nicht gefunden.') {
    super(404, nachricht);
  }
}

export class BadRequestException extends HttpFehler {
  constructor(nachricht = 'Die Anfrage ist ungültig.') {
    super(400, nachricht);
  }
}

export class ConflictException extends HttpFehler {
  constructor(nachricht = 'Der Vorgang steht im Widerspruch zum aktuellen Stand.') {
    super(409, nachricht);
  }
}

export class UnauthorizedException extends HttpFehler {
  constructor(nachricht = 'Anmeldung erforderlich.') {
    super(401, nachricht);
  }
}

export class ForbiddenException extends HttpFehler {
  constructor(nachricht = 'Für diese Aktion fehlt die erforderliche Berechtigung.') {
    super(403, nachricht);
  }
}

export class UnprocessableEntityException extends HttpFehler {
  constructor(nachricht = 'Die Eingabe kann nicht verarbeitet werden.') {
    super(422, nachricht);
  }
}

/**
 * Schlichter Ersatz für Nests Logger. Bei Hostinger landet die Ausgabe im
 * Anwendungsprotokoll, das über hPanel einsehbar ist.
 */
export class Logger {
  constructor(private readonly bereich: string) {}

  private schreibe(stufe: 'log' | 'warn' | 'error', nachricht: unknown, zusatz?: unknown): void {
    const kopf = `[${this.bereich}]`;
    if (zusatz === undefined) {
      console[stufe === 'log' ? 'info' : stufe](kopf, nachricht);
    } else {
      console[stufe === 'log' ? 'info' : stufe](kopf, nachricht, zusatz);
    }
  }

  log(nachricht: unknown, zusatz?: unknown): void {
    this.schreibe('log', nachricht, zusatz);
  }

  warn(nachricht: unknown, zusatz?: unknown): void {
    this.schreibe('warn', nachricht, zusatz);
  }

  error(nachricht: unknown, zusatz?: unknown): void {
    this.schreibe('error', nachricht, zusatz);
  }

  debug(nachricht: unknown, zusatz?: unknown): void {
    if (process.env.NODE_ENV === 'development') this.schreibe('log', nachricht, zusatz);
  }
}
