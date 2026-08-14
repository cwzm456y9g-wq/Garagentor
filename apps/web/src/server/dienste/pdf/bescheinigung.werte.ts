/**
 * Textaufbereitung für die Prüfbescheinigung.
 *
 * Bewusst ohne Bezug auf react-pdf: Was auf einer Bescheinigung steht, ist eine
 * fachliche Aussage und soll sich einzeln prüfen lassen – der Satz „Die Anlage
 * ist in Ordnung“ darf nicht versehentlich unter einem Ergebnis stehen, das
 * etwas anderes besagt.
 *
 * Die Bescheinigung nennt nur den Befund, nicht die Einzelheiten. Genau eine
 * Ausnahme gibt es, und sie ist keine Nachlässigkeit: Ein sicherheitsrelevanter
 * Mangel wird ausgesprochen, samt der Folge für den Betrieb der Anlage.
 */

export interface BescheinigungsMangel {
  severity: string;
}

export interface Befund {
  /** Bestimmt die Farbe des Ergebniskastens. */
  ton: 'gut' | 'hinweis' | 'ernst';
  /** Die große Zeile: die Antwort auf „in Ordnung oder nicht?“. */
  ueberschrift: string;
  /** Ein Satz zur Einordnung – ohne Einzelheiten aus dem Protokoll. */
  satz: string;
  /** Nur bei sicherheitsrelevanten Mängeln gesetzt. */
  warnung: string | null;
  /** Anzahl der festgestellten Mängel; 0, wenn keine. */
  anzahl: number;
}

const SICHERHEITSRELEVANT = ['GEFAHR_IM_VERZUG', 'ERHEBLICH'];

/** Ob unter den Mängeln einer ist, der den Weiterbetrieb ausschließt. */
export function gefahrImVerzug(maengel: BescheinigungsMangel[]): boolean {
  return maengel.some((mangel) => mangel.severity === 'GEFAHR_IM_VERZUG');
}

/** Ob ein Mangel dabei ist, der nicht bis zur nächsten Prüfung warten kann. */
export function sicherheitsrelevant(maengel: BescheinigungsMangel[]): boolean {
  return maengel.some((mangel) => SICHERHEITSRELEVANT.includes(mangel.severity));
}

function anzahlSatz(anzahl: number): string {
  if (anzahl === 0) return '';
  return anzahl === 1
    ? 'Es wurde ein Mangel festgestellt.'
    : `Es wurden ${anzahl} Mängel festgestellt.`;
}

/**
 * Der Befund zu einem abgeschlossenen Prüfergebnis.
 *
 * Ohne Ergebnis gibt es keinen Befund – dann ist die Prüfung nicht
 * abgeschlossen, und eine Bescheinigung darüber wäre eine Behauptung ins Blaue.
 * Der Dienst lässt es gar nicht erst so weit kommen; hier steht der Fall nur,
 * damit die Funktion für jede Eingabe eine ehrliche Antwort gibt.
 */
export function bescheinigungsBefund(
  ergebnis: string | null | undefined,
  maengel: BescheinigungsMangel[] = [],
): Befund {
  const anzahl = maengel.length;
  const warnung = gefahrImVerzug(maengel)
    ? 'Gefahr im Verzug: Die Anlage ist bis zur Instandsetzung außer Betrieb zu nehmen.'
    : null;

  switch (ergebnis) {
    // Die Warnung steht auch hier, obwohl sie dem Ergebnis widerspricht: Ein
    // Mangel mit Gefahr im Verzug entsteht sonst nur zusammen mit „nicht
    // bestanden“, kann aber nachträglich von Hand eingetragen worden sein.
    // Träte er dann nirgends auf, verschwiege die Bescheinigung genau das, was
    // sie unbedingt sagen muss. Der Widerspruch fällt auf – das Verschweigen
    // nicht.
    case 'BESTANDEN':
      return {
        ton: 'gut',
        ueberschrift: 'Die Anlage ist in Ordnung.',
        satz: 'Bei der Prüfung wurden keine Mängel festgestellt. Die Anlage kann weiter betrieben werden.',
        warnung,
        anzahl: 0,
      };

    case 'BESTANDEN_MIT_HINWEISEN':
      return {
        ton: 'gut',
        ueberschrift: 'Die Anlage ist in Ordnung.',
        satz:
          'Es wurden keine Mängel festgestellt. Zum Zustand einzelner Bauteile bestehen ' +
          'Hinweise, die im Prüfprotokoll festgehalten sind; die Anlage kann weiter ' +
          'betrieben werden.',
        warnung,
        anzahl,
      };

    case 'GERINGE_MAENGEL':
      return {
        ton: 'hinweis',
        ueberschrift: 'Es sind Mängel vorhanden.',
        satz:
          `${anzahlSatz(anzahl)} Die Anlage kann bis zur Behebung weiter betrieben werden. ` +
          'Wir empfehlen, die Instandsetzung zeitnah zu beauftragen.',
        warnung,
        anzahl,
      };

    case 'ERHEBLICHE_MAENGEL':
      return {
        ton: 'ernst',
        ueberschrift: 'Es sind erhebliche Mängel vorhanden.',
        satz:
          `${anzahlSatz(anzahl)} Die Anlage ist kurzfristig instand zu setzen; bis dahin ist ` +
          'der Betrieb nur unter Aufsicht zulässig.',
        warnung,
        anzahl,
      };

    case 'NICHT_BESTANDEN':
      return {
        ton: 'ernst',
        ueberschrift: 'Die Anlage ist nicht betriebssicher.',
        satz:
          `${anzahlSatz(anzahl)} Die Anlage ist bis zur Instandsetzung außer Betrieb zu ` +
          'nehmen und gegen Benutzung zu sichern.',
        // Keine zusätzliche Warnung: Der Satz oben ordnet die Außerbetriebnahme
        // schon an. Zweimal dasselbe zu verlangen, liest sich nicht dringlicher,
        // sondern nachlässig – und schob den Nachweis auf ein zweites Blatt.
        warnung: null,
        anzahl,
      };

    default:
      return {
        ton: 'hinweis',
        ueberschrift: 'Die Prüfung ist noch nicht abgeschlossen.',
        satz: 'Für diese Prüfung liegt noch kein Ergebnis vor.',
        warnung: null,
        anzahl,
      };
  }
}

/** Der Satz über der Unterschrift. */
export function bescheinigungsSatz(befund: Befund): string {
  const grundsatz =
    'Die Prüfung wurde im vorgeschriebenen Umfang durchgeführt. Das Ergebnis bezieht sich ' +
    'auf den Zustand der Anlage am Prüftag.';

  return befund.ton === 'ernst'
    ? `${grundsatz} Der Betreiber wurde über die festgestellten Mängel unterrichtet.`
    : grundsatz;
}
