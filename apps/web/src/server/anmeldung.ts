import type { AuthUser, JwtPayload } from '@garagentor/shared';
import { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { konfiguration } from './konfiguration';
import { mitKontext } from './kontext';
import { nichtAngemeldet, verboten, zuAntwort } from './fehler';
import { prisma } from './prisma';

/**
 * Prüft den Access-Token und lädt den Benutzer frisch aus der Datenbank, damit
 * Rollenänderungen und Sperrungen sofort greifen – ein Token, der noch zehn
 * Minuten läuft, soll einem entlassenen Monteur nicht weiter Zugriff geben.
 */
export async function benutzerAusAnfrage(anfrage: Request): Promise<AuthUser> {
  const kopf = anfrage.headers.get('authorization');
  if (!kopf?.startsWith('Bearer ')) {
    throw nichtAngemeldet();
  }

  let inhalt: JwtPayload;
  try {
    inhalt = jwt.verify(kopf.slice(7), konfiguration().jwt.zugangsGeheimnis) as JwtPayload;
  } catch {
    throw nichtAngemeldet('Der Zugang ist abgelaufen oder ungültig.');
  }

  if (inhalt.typ !== 'access') {
    throw nichtAngemeldet('Es wurde kein Access-Token übergeben.');
  }

  const benutzer = await prisma.user.findUnique({ where: { id: inhalt.sub } });
  if (!benutzer || !benutzer.active) {
    throw nichtAngemeldet('Das Benutzerkonto ist nicht mehr gültig.');
  }

  return {
    id: benutzer.id,
    email: benutzer.email,
    firstName: benutzer.firstName,
    lastName: benutzer.lastName,
    role: benutzer.role,
    employeeId: benutzer.employeeId,
  };
}

/**
 * Administratoren kommen grundsätzlich durch, damit die Rollenlisten der
 * einzelnen Endpunkte übersichtlich bleiben. Das entspricht dem Verhalten des
 * bisherigen RolesGuard.
 */
function pruefeRolle(benutzer: AuthUser, erlaubt?: readonly Role[]): void {
  if (!erlaubt || erlaubt.length === 0) return;
  if (benutzer.role === Role.ADMIN) return;
  if (erlaubt.includes(benutzer.role)) return;
  throw verboten();
}

/** Was ein Route Handler außer der Anfrage bekommt. */
export interface Beiwerk<P> {
  benutzer: AuthUser;
  params: P;
}

type NextKontext<P> = { params: Promise<P> };

/**
 * Umhüllt einen Endpunkt: Anmeldung prüfen, Rolle prüfen, Benutzer für das
 * Änderungsprotokoll ablegen, Fehler in saubere Antworten übersetzen.
 *
 * In NestJS erledigten das vier getrennte Bausteine – ein globaler Guard, ein
 * Rollen-Guard, ein Interceptor und ein Exception-Filter. Ohne Nests
 * Metadaten-Reflexion ist eine Umhüllung je Endpunkt der ehrlichere Weg: man
 * sieht an der Route selbst, wer sie aufrufen darf.
 */
export function geschuetzt<P = Record<string, never>>(
  behandler: (anfrage: Request, beiwerk: Beiwerk<P>) => Promise<Response>,
  erlaubt?: readonly Role[],
): (anfrage: Request, kontext: NextKontext<P>) => Promise<Response> {
  return async (anfrage, kontext) => {
    try {
      const benutzer = await benutzerAusAnfrage(anfrage);
      pruefeRolle(benutzer, erlaubt);
      const params = kontext?.params ? await kontext.params : ({} as P);
      return await mitKontext({ benutzerId: benutzer.id }, () =>
        behandler(anfrage, { benutzer, params }),
      );
    } catch (fehler) {
      return zuAntwort(fehler, new URL(anfrage.url).pathname);
    }
  };
}

/**
 * Für die wenigen Endpunkte ohne Anmeldung – Login, Token-Erneuerung,
 * Erreichbarkeitsprüfung. Fehlerbehandlung gibt es trotzdem.
 */
export function offen<P = Record<string, never>>(
  behandler: (anfrage: Request, params: P) => Promise<Response>,
): (anfrage: Request, kontext: NextKontext<P>) => Promise<Response> {
  return async (anfrage, kontext) => {
    try {
      const params = kontext?.params ? await kontext.params : ({} as P);
      return await behandler(anfrage, params);
    } catch (fehler) {
      return zuAntwort(fehler, new URL(anfrage.url).pathname);
    }
  };
}
