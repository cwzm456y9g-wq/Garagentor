/**
 * Regeln für das Zurücksetzen der Betriebsdaten.
 *
 * Hier steht die Arithmetik und stehen die Listen, nicht die Datenbankzugriffe
 * – damit sich beides prüfen läßt, ohne eine Datenbank zu leeren.
 *
 * Der Leitsatz des ganzen Vorgangs paßt in einen Satz: Was an einem Kunden
 * oder an einem seiner Vorgänge hängt, geht mit. Was dem Betrieb selbst gehört
 * – Artikel, Lieferanten, Mitarbeiter, Zugänge, Einstellungen –, bleibt.
 */

/**
 * Das Wort, das getippt werden muß.
 *
 * Kein Kreuzchen und kein zweiter Klick: Beides macht man versehentlich. Ein
 * Wort abzutippen ist die kleinste Hürde, die man nicht aus Versehen nimmt.
 */
export const BESTAETIGUNG = 'ZURUECKSETZEN';

/**
 * Belegarten, deren Zähler wieder bei 1 beginnen.
 *
 * Nur die, deren Belege verschwinden. Lieferanten, Artikel, Mitarbeiter und
 * Bestellungen behalten ihre Nummern – ihre Datensätze bleiben ja auch, und
 * eine zweite RE-2026-0001 neben einer bestehenden wäre ein Fehler, den kein
 * Betriebsprüfer übersieht.
 */
export const NUMMERNKREISE = [
  'CUSTOMER',
  'QUOTE',
  'ORDER',
  'INVOICE',
  'SERVICE_REPORT',
  'INSPECTION',
  'PROJECT',
  'DOOR',
  'MAINTENANCE_CONTRACT',
] as const;

/**
 * Entitätsarten, deren Akten und Mailprotokolle mitgehen.
 *
 * `PROJECT` fehlt mit Absicht: Projekte werden nur gelöscht, soweit sie an
 * einem Kunden hängen, deshalb entscheidet dort die Kennung, nicht die Art.
 */
export const GELOESCHTE_ARTEN = [
  'CUSTOMER',
  'SITE',
  'QUOTE',
  'ORDER',
  'INVOICE',
  'DOOR',
  'INSPECTION',
  'SERVICE_REPORT',
  'MAINTENANCE_CONTRACT',
] as const;

/** Eine Lagerbewegung, soweit sie für die Rückrechnung zählt. */
export interface Bewegung {
  articleId: string;
  type: string;
  quantity: number;
}

/**
 * Wieviel je Artikel auf den Bestand zurückzubuchen ist.
 *
 * Wird ein Servicebericht gelöscht, verschwindet auch die Abgangsbuchung, mit
 * der er Material aus dem Lager genommen hat. Bliebe der Bestand, wie er ist,
 * stünde im Lager eine Menge, zu der keine Bewegung mehr paßt – und die
 * fehlenden Teile hätte man beim nächsten Zählen zu suchen.
 *
 * Zugang und Abgang lassen sich sauber umkehren. Inventur, Korrektur und
 * Umlagerung setzen einen absoluten Bestand; was vorher stand, geht aus der
 * Buchung nicht hervor. Diese bleiben ungerechnet und werden gemeldet, statt
 * eine Zahl zu erfinden.
 */
export function bestandsRueckstellung(bewegungen: Bewegung[]): {
  deltas: Map<string, number>;
  ungerechnet: number;
} {
  const deltas = new Map<string, number>();
  let ungerechnet = 0;

  for (const bewegung of bewegungen) {
    let delta: number;
    switch (bewegung.type) {
      case 'ABGANG':
        delta = bewegung.quantity;
        break;
      case 'ZUGANG':
      case 'RETOURE':
        delta = -bewegung.quantity;
        break;
      default:
        ungerechnet += 1;
        continue;
    }

    deltas.set(bewegung.articleId, (deltas.get(bewegung.articleId) ?? 0) + delta);
  }

  // Buchungen, die sich gegenseitig aufheben, brauchen keine Schreiboperation.
  for (const [artikel, delta] of deltas) {
    if (runden(delta) === 0) deltas.delete(artikel);
    else deltas.set(artikel, runden(delta));
  }

  return { deltas, ungerechnet };
}

/** Auf drei Stellen, wie das Datenmodell die Mengen führt. */
function runden(wert: number): number {
  return Math.round(wert * 1000) / 1000;
}
