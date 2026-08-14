/**
 * Was beim Entfernen eines Belegs tatsächlich geschieht.
 *
 * Angebot, Auftrag und Rechnung verschwinden nur, solange sie Entwurf sind.
 * Danach bleiben sie stehen und werden storniert – und gibt es einen
 * Folgebeleg, geht auch das nicht mehr. Welcher der drei Fälle vorliegt,
 * entscheidet der Server; hier steht dieselbe Regel noch einmal, damit der
 * Knopf ankündigen kann, was er auslöst.
 *
 * Zwei Regeln an einer Stelle sind ein Risiko – deshalb die Prüfungen daneben,
 * die sie gegen die Bedingungen der Dienste halten. Das Risiko einzugehen ist
 * trotzdem richtig: Ein Knopf, der „Löschen" heißt und storniert, ist
 * schlimmer als eine doppelte Regel.
 */

export interface Wirkung {
  /** Ob der Vorgang überhaupt möglich ist. */
  moeglich: boolean;
  /** Beschriftung des auslösenden Knopfes. */
  beschriftung: string;
  /** Überschrift der Rückfrage. */
  titel: string;
  /** Beschriftung im Bestätigungsfenster. */
  knopf: string;
  /** Was geschieht, in ganzen Sätzen. */
  beschreibung: string;
}

const NICHT_MOEGLICH = (grund: string): Wirkung => ({
  moeglich: false,
  beschriftung: 'Entfernen',
  titel: 'Nicht möglich',
  knopf: 'Verstanden',
  beschreibung: grund,
});

const GOBD =
  'Löschen ist nicht möglich: Ein einmal ausgestellter Beleg muß nach den Grundsätzen zur ' +
  'ordnungsmäßigen Buchführung nachvollziehbar bleiben.';

/**
 * Angebot. Der Dienst löscht nur Entwürfe und verweigert alles, woraus schon
 * ein Auftrag entstanden ist.
 */
export function angebotWirkung(nummer: string, status: string, auftraege: number): Wirkung {
  if (auftraege > 0) {
    return NICHT_MOEGLICH(
      `Zum Angebot ${nummer} gehört bereits ein Auftrag. Solange der besteht, läßt sich das ` +
        'Angebot weder löschen noch stornieren – sonst stünde der Auftrag ohne seine Grundlage da.',
    );
  }

  if (status === 'STORNIERT') {
    return NICHT_MOEGLICH(`Das Angebot ${nummer} ist bereits storniert.`);
  }

  if (status === 'ENTWURF') {
    return {
      moeglich: true,
      beschriftung: 'Löschen',
      titel: `Angebot ${nummer} löschen`,
      knopf: 'Endgültig löschen',
      beschreibung:
        `Der Entwurf ${nummer} wird vollständig entfernt. Versendet wurde er nicht, ` +
        'ein Beleg war er damit nie.',
    };
  }

  return {
    moeglich: true,
    beschriftung: 'Stornieren',
    titel: `Angebot ${nummer} stornieren`,
    knopf: 'Stornieren',
    beschreibung:
      `Das Angebot ${nummer} bleibt erhalten und wird als storniert gekennzeichnet. ` +
      'Es ist beim Kunden bereits herausgegangen; deshalb wird es nicht gelöscht, sondern ' +
      'als hinfällig vermerkt.',
  };
}

/**
 * Auftrag. Gelöscht wird nur, was noch nicht begonnen hat; sobald Rechnungen
 * daran hängen, geht gar nichts mehr.
 */
export function auftragWirkung(nummer: string, status: string, rechnungen: number): Wirkung {
  if (rechnungen > 0) {
    return NICHT_MOEGLICH(
      `Zum Auftrag ${nummer} gehören Rechnungen. Solange die bestehen, läßt sich der Auftrag ` +
        'weder löschen noch stornieren – die Rechnungen verlören sonst ihren Bezug.',
    );
  }

  if (status === 'STORNIERT') {
    return NICHT_MOEGLICH(`Der Auftrag ${nummer} ist bereits storniert.`);
  }

  if (status === 'ANGELEGT') {
    return {
      moeglich: true,
      beschriftung: 'Löschen',
      titel: `Auftrag ${nummer} löschen`,
      knopf: 'Endgültig löschen',
      beschreibung:
        `Der Auftrag ${nummer} wird vollständig entfernt. Er ist angelegt, aber noch nicht ` +
        'in Arbeit – es geht dabei nichts verloren, was jemand geleistet hat.',
    };
  }

  return {
    moeglich: true,
    beschriftung: 'Stornieren',
    titel: `Auftrag ${nummer} stornieren`,
    knopf: 'Stornieren',
    beschreibung:
      `Der Auftrag ${nummer} bleibt erhalten und wird als storniert gekennzeichnet. Er ist ` +
      'bereits über den Anfang hinaus; Termine und Berichte dazu bleiben lesbar.',
  };
}

/**
 * Rechnung. Ein Entwurf wird entfernt, alles andere storniert – und war schon
 * Geld darauf, entsteht dabei eine Gutschrift.
 */
export function rechnungWirkung(nummer: string, status: string, bezahlt: number): Wirkung {
  if (status === 'STORNIERT') {
    return NICHT_MOEGLICH(`Die Rechnung ${nummer} ist bereits storniert.`);
  }

  if (status === 'ENTWURF') {
    return {
      moeglich: true,
      beschriftung: 'Entwurf löschen',
      titel: `Entwurf ${nummer} löschen`,
      knopf: 'Endgültig löschen',
      beschreibung:
        `Der Entwurf ${nummer} wird vollständig entfernt. Er war nie ein Beleg – versendet ` +
        'wurde er nicht, gebucht auch nicht. Der Vorgang wird im Änderungsprotokoll vermerkt.',
    };
  }

  const gutschrift =
    bezahlt > 0
      ? ` Auf die Rechnung wurden bereits ${bezahlt.toLocaleString('de-DE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} € gezahlt – dafür entsteht automatisch eine Gutschrift.`
      : '';

  return {
    moeglich: true,
    beschriftung: 'Stornieren',
    titel: `Rechnung ${nummer} stornieren`,
    knopf: 'Stornieren',
    beschreibung:
      `Die Rechnung ${nummer} bleibt erhalten und wird als storniert gekennzeichnet. ${GOBD}` +
      `${gutschrift} Offene Mahnungen werden abgebrochen.`,
  };
}
