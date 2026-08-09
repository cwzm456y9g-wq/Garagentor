import type { MailDocumentType } from '@garagentor/shared';
import { Role } from '@prisma/client';
import { verboten } from '@/server/fehler';

/**
 * Welche Rollen eine Belegart verschicken dürfen.
 *
 * Der Monteur soll den Bericht vom Einsatz mitschicken können, aber weder
 * Rechnungen noch Mahnungen – das ist dieselbe Grenze wie in der Buchhaltung.
 */
const VERSANDRECHTE: Record<MailDocumentType, Role[]> = {
  ANGEBOT: [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
  RECHNUNG: [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
  MAHNUNG: [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
  SERVICEBERICHT: [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
  PRUEFPROTOKOLL: [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR],
};

/**
 * Die Prüfung steht hier statt in der Rollenliste der Route, weil das erlaubte
 * Rollenbild von der Belegart im Rumpf abhängt. Administratoren dürfen alles –
 * dieselbe Regel gilt in der Umhüllung, und zwei verschiedene Antworten auf
 * dieselbe Frage wären nicht zu erklären.
 */
export function pruefeVersandrecht(art: MailDocumentType, rolle: Role): void {
  if (rolle === Role.ADMIN || VERSANDRECHTE[art].includes(rolle)) return;
  throw verboten('Für diese Belegart fehlt die erforderliche Berechtigung.');
}
