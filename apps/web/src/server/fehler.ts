import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

/**
 * Ein Fehler, der bewusst nach außen darf.
 *
 * NestJS hatte für jeden Fall eine eigene Ausnahmeklasse. Hier genügt eine mit
 * Statuscode – entscheidend ist die Trennung: Was diese Klasse trägt, wird dem
 * Aufrufer wörtlich gezeigt. Alles andere wird zu „Interner Serverfehler" und
 * landet nur im Protokoll.
 */
export class HttpFehler extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly felder?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpFehler';
  }
}

export const nichtAngemeldet = (text = 'Anmeldung erforderlich.') => new HttpFehler(401, text);
export const verboten = (text = 'Für diese Aktion fehlt die erforderliche Berechtigung.') =>
  new HttpFehler(403, text);
export const nichtGefunden = (text = 'Der Datensatz wurde nicht gefunden.') =>
  new HttpFehler(404, text);
export const konflikt = (text: string) => new HttpFehler(409, text);
export const ungueltig = (text: string, felder?: Record<string, string>) =>
  new HttpFehler(400, text, felder);

interface Fehlerkoerper {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  felder?: Record<string, string>;
}

const BENENNUNG: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
};

/**
 * Übersetzt Prisma-Fehler in aussagekräftige Antworten, damit keine internen
 * Datenbankdetails nach außen gelangen.
 */
function ausPrisma(fehler: Prisma.PrismaClientKnownRequestError): HttpFehler {
  switch (fehler.code) {
    case 'P2002': {
      const ziel = fehler.meta?.target;
      const felder = Array.isArray(ziel) ? ziel.join(', ') : String(ziel ?? 'Feld');
      return konflikt(`Es existiert bereits ein Datensatz mit diesem Wert (${felder}).`);
    }
    case 'P2003':
      return konflikt('Der Datensatz ist noch mit anderen Datensätzen verknüpft.');
    case 'P2025':
      return nichtGefunden();
    case 'P2014':
      return konflikt('Die Änderung verletzt eine bestehende Beziehung.');
    default:
      return new HttpFehler(500, 'Datenbankfehler');
  }
}

/**
 * Fasst die Meldungen einer Zod-Prüfung so zusammen, wie es Nests
 * ValidationPipe tat: je Feld nur der erste Verstoß, damit Formulare eine
 * eindeutige Meldung anzeigen können.
 */
function ausZod(fehler: ZodError): HttpFehler {
  const felder: Record<string, string> = {};
  for (const problem of fehler.issues) {
    const pfad = problem.path.join('.') || '(Rumpf)';
    if (!(pfad in felder)) felder[pfad] = problem.message;
  }
  const erstes = Object.entries(felder)[0];
  const text = erstes ? `${erstes[0]}: ${erstes[1]}` : 'Die Eingabe ist ungültig.';
  return ungueltig(text, felder);
}

/** Bringt einen beliebigen Fehler in die Form, die der Aufrufer sieht. */
export function zuAntwort(fehler: unknown, pfad: string): Response {
  let http: HttpFehler;

  if (fehler instanceof HttpFehler) {
    http = fehler;
  } else if (fehler instanceof ZodError) {
    http = ausZod(fehler);
  } else if (fehler instanceof Prisma.PrismaClientKnownRequestError) {
    http = ausPrisma(fehler);
  } else if (fehler instanceof Prisma.PrismaClientValidationError) {
    http = ungueltig('Ungültige Anfrage an die Datenbank');
  } else {
    http = new HttpFehler(500, 'Interner Serverfehler');
  }

  // Alles, was nicht absichtlich nach außen geht, gehört ins Protokoll –
  // sonst sucht man den Grund später vergeblich.
  if (http.status >= 500) {
    console.error(`[${pfad}]`, fehler);
  }

  const koerper: Fehlerkoerper = {
    statusCode: http.status,
    message: http.message,
    error: BENENNUNG[http.status] ?? 'Error',
    timestamp: new Date().toISOString(),
    path: pfad,
    ...(http.felder ? { felder: http.felder } : {}),
  };

  return Response.json(koerper, { status: http.status });
}
