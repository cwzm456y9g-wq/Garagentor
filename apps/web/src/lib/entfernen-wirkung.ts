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

/**
 * Ein aussichtsloser Fall.
 *
 * Der Knopf bleibt trotzdem stehen und trägt die Beschriftung, die er sonst
 * trüge – geklickt erklärt er, warum es nicht geht. Ihn zu verstecken wäre
 * bequemer, ließe aber die Frage offen, die der Betrachter tatsächlich hat:
 * Warum werde ich das nicht los?
 */
const NICHT_MOEGLICH = (grund: string, beschriftung = 'Löschen'): Wirkung => ({
  moeglich: false,
  beschriftung,
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
    return NICHT_MOEGLICH(`Das Angebot ${nummer} ist bereits storniert.`, 'Stornieren');
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
    return NICHT_MOEGLICH(`Der Auftrag ${nummer} ist bereits storniert.`, 'Stornieren');
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
    return NICHT_MOEGLICH(`Die Rechnung ${nummer} ist bereits storniert.`, 'Stornieren');
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

/* Stammdaten ------------------------------------------------------------ */

/**
 * Kunde, Toranlage und Mitarbeiter verhalten sich gleich – und anders als die
 * Belege: Hängt Geschichte daran, verschwinden sie nicht, sondern werden
 * stillgelegt. Das ist kein Trostpreis, sondern die richtige Wahl: Ein Kunde
 * mit Rechnungen aus dem Vorjahr muß auffindbar bleiben, auch wenn man nicht
 * mehr für ihn arbeitet.
 *
 * Die Zähler kommen aus derselben Quelle, die der Dienst prüft. Stehen sie auf
 * null, wird wirklich gelöscht.
 */
function stillegenOderLoeschen(opts: {
  bezeichnung: string;
  was: string;
  belastet: boolean;
  /** Was an Geschichte hängt, für den erklärenden Satz. */
  anhang: string;
  /** Wie der Zustand danach heißt. */
  zustand: string;
  folgen: string;
}): Wirkung {
  if (opts.belastet) {
    return {
      moeglich: true,
      beschriftung: 'Stilllegen',
      titel: `${opts.bezeichnung} stilllegen`,
      knopf: 'Stilllegen',
      beschreibung:
        `${opts.bezeichnung} bleibt erhalten und wird auf „${opts.zustand}“ gesetzt. ` +
        `${opts.anhang} ${opts.folgen}`,
    };
  }

  return {
    moeglich: true,
    beschriftung: 'Löschen',
    titel: `${opts.bezeichnung} löschen`,
    knopf: 'Endgültig löschen',
    beschreibung:
      `${opts.bezeichnung} wird vollständig entfernt. Es hängt keine Geschichte daran – ` +
      `${opts.was}`,
  };
}

/** Kunde. Belastet ihn ein Beleg oder eine Anlage, wird er stillgelegt. */
export function kundeWirkung(
  name: string,
  zaehler: { quotes?: number; orders?: number; invoices?: number; doors?: number } | undefined,
): Wirkung {
  const z = zaehler ?? {};
  const summe = (z.quotes ?? 0) + (z.orders ?? 0) + (z.invoices ?? 0) + (z.doors ?? 0);

  return stillegenOderLoeschen({
    bezeichnung: name,
    was: 'weder Angebot noch Auftrag, Rechnung oder Toranlage.',
    belastet: summe > 0,
    zustand: 'nicht aktiv',
    anhang:
      'Belege und Anlagen bleiben lesbar – eine Rechnung aus dem Vorjahr muß auffindbar sein, ' +
      'auch wenn man nicht mehr für ihn arbeitet.',
    folgen: 'In den Auswahllisten für neue Vorgänge erscheint er nicht mehr.',
  });
}

/** Toranlage. Ist sie geprüft oder gewartet worden, wird sie stillgelegt. */
export function anlageWirkung(
  nummer: string,
  zaehler: { inspections?: number; serviceReports?: number } | undefined,
): Wirkung {
  const z = zaehler ?? {};
  const summe = (z.inspections ?? 0) + (z.serviceReports ?? 0);

  return stillegenOderLoeschen({
    bezeichnung: `Die Anlage ${nummer}`,
    was: 'keine Prüfung und kein Servicebericht.',
    belastet: summe > 0,
    zustand: 'stillgelegt',
    anhang: 'Prüfprotokolle und Serviceberichte bleiben als Nachweis erhalten.',
    folgen: 'Eine Prüfung wird für sie nicht mehr fällig.',
  });
}

/** Mitarbeiter. Hat er gearbeitet, geprüft oder berichtet, wird er stillgelegt. */
export function mitarbeiterWirkung(
  name: string,
  zaehler: { timeEntries?: number; inspections?: number; serviceReports?: number } | undefined,
): Wirkung {
  const z = zaehler ?? {};
  const summe = (z.timeEntries ?? 0) + (z.inspections ?? 0) + (z.serviceReports ?? 0);

  return stillegenOderLoeschen({
    bezeichnung: name,
    was: 'keine erfaßte Zeit, keine Prüfung und kein Servicebericht.',
    belastet: summe > 0,
    zustand: 'ausgeschieden',
    anhang:
      'Zeiten, Prüfungen und Berichte bleiben ihm zugeordnet – ein Prüfprotokoll ohne prüfende ' +
      'Person wäre als Nachweis wertlos.',
    folgen: 'Das Austrittsdatum wird auf heute gesetzt, sofern noch keines eingetragen ist.',
  });
}

/**
 * Servicebericht. Nur ein Entwurf verschwindet – ein abgeschlossener ist mit
 * der Unterschrift des Kunden ein Nachweis der geleisteten Arbeit.
 */
export function serviceberichtWirkung(nummer: string, status: string): Wirkung {
  if (status !== 'ENTWURF') {
    return NICHT_MOEGLICH(
      `Der Servicebericht ${nummer} ist abgeschlossen und damit der Nachweis der geleisteten ` +
        'Arbeit – oft mit der Unterschrift des Kunden. Er kann nicht gelöscht werden.',
    );
  }

  return {
    moeglich: true,
    beschriftung: 'Löschen',
    titel: `Entwurf ${nummer} löschen`,
    knopf: 'Endgültig löschen',
    beschreibung:
      `Der Berichtsentwurf ${nummer} wird vollständig entfernt. Er ist weder abgeschlossen ` +
      'noch abgerechnet; verbuchtes Material gibt es dazu noch nicht.',
  };
}
