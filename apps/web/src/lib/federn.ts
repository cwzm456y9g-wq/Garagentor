/**
 * Torsionsfedern für Toranlagen – Rechnen und Beurteilen.
 *
 * Zwei Aufgaben, die im Betrieb ständig vorkommen und beide von Hand mühsam
 * sind:
 *
 * **Ausmessen.** Die Feder ist gebrochen, das Tor hing bisher im Gleichgewicht.
 * Aus Drahtstärke, Windungsdurchmesser und Windungszahl ergibt sich, was sie
 * geleistet hat – und damit, ob der angebotene Ersatz derselbe ist.
 *
 * **Auslegen.** Kein Vergleichsstück da: Umbau, unbekanntes Fabrikat, oder das
 * Torblatt ist schwerer geworden. Aus Torgewicht, Torhöhe und Trommelradius
 * ergibt sich, welche Feder es braucht.
 *
 * Alles hier ist reine Rechnung ohne Datenbank – damit es sich prüfen läßt.
 *
 * ## Die Physik in einem Absatz
 *
 * Eine Schenkelfeder wird beim Aufdrehen nicht verdreht, sondern **gebogen**.
 * Der Draht ist ein langer Balken, der auf einen Zylinder gewickelt ist. Dreht
 * man ihn um Δn Umdrehungen auf, ändert sich seine Krümmung, und in der
 * Drahtrandfaser entsteht eine Biegespannung. Daraus folgt alles Weitere.
 */

/** Elastizitätsmodul für Federstahldraht. */
export const E_MODUL = 206_000; // N/mm²

/** Fallbeschleunigung, für die Umrechnung von Kilogramm in Newton. */
export const G = 9.81; // m/s²

/**
 * Zulässige statische Biegespannung nach DIN EN 13906-3, als Anteil der
 * Zugfestigkeit. Oberhalb davon ist bleibende Verformung möglich.
 */
export const ZULAESSIG_STATISCH = 0.7;

/** Handelsübliche Drahtstärken in mm. */
export const DRAHTSTAERKEN = [
  3.0, 3.2, 3.5, 3.8, 4.0, 4.2, 4.5, 4.8, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0,
];

/* Was der Betrieb führt ------------------------------------------------- */

/**
 * Eine Seiltrommel.
 *
 * Der Radius ist der einzige Wert, der in die Rechnung eingeht – und zwar
 * **am Seilgrund** gemessen, nicht am Flansch. Zwischen beiden liegen bei
 * einer üblichen Trommel gut zwei Zentimeter, und das sind über 40 % Irrtum
 * im Haltemoment.
 */
export interface Trommel {
  name: string;
  radiusMm: number;
}

/**
 * Eine Federreihe, wie sie ein Lieferant führt.
 *
 * Der Innendurchmesser ist meist durch die Welle vorgegeben. Sind
 * Drahtstärken hinterlegt, rechnet die Auslegung nur mit diesen – dann stehen
 * in der Vorschlagsliste nur Federn, die es auch zu kaufen gibt.
 */
export interface Federreihe {
  name: string;
  innenMm: number;
  /** Leer heißt: alle handelsüblichen Stärken. */
  drahtstaerken: number[];
}

/**
 * Vorgaben zum Überschreiben.
 *
 * Bewußt keine Herstellerbezeichnungen: Welche Trommel welchen Seilradius hat,
 * steht im Datenblatt des Herstellers oder läßt sich einmal nachmessen –
 * erfundene Typennummern wären schlimmer als keine. Der Betrieb trägt hier
 * ein, was er führt.
 */
export const TROMMELN_VORGABE: Trommel[] = [
  { name: 'Standard-Lift, klein', radiusMm: 32 },
  { name: 'Standard-Lift, mittel', radiusMm: 46 },
  { name: 'Standard-Lift, groß', radiusMm: 56 },
  { name: 'Industrietor', radiusMm: 76 },
];

export const REIHEN_VORGABE: Federreihe[] = [
  { name: 'Ø 32 mm', innenMm: 32, drahtstaerken: [] },
  { name: 'Ø 42 mm', innenMm: 42, drahtstaerken: [] },
  { name: 'Ø 51 mm (2″)', innenMm: 50.8, drahtstaerken: [] },
  { name: 'Ø 67 mm (2⅝″)', innenMm: 67, drahtstaerken: [] },
  { name: 'Ø 95 mm (3¾″)', innenMm: 95.25, drahtstaerken: [] },
];

export interface Werkstattlisten {
  trommeln: Trommel[];
  reihen: Federreihe[];
}

const positiv = (wert: unknown): wert is number =>
  typeof wert === 'number' && Number.isFinite(wert) && wert > 0;

const benannt = (wert: unknown): wert is string => typeof wert === 'string' && wert.trim() !== '';

/**
 * Liest die hinterlegten Listen und wirft weg, was unbrauchbar ist.
 *
 * Die Einstellung ist freies JSON. Ein halb gefüllter oder von Hand
 * verunglückter Eintrag darf den Rechner nicht lahmlegen – wer draußen am Tor
 * steht, ist mit einer leeren Auswahl schlechter bedient als mit den Vorgaben.
 */
export function werkstattlisten(wert: unknown): Werkstattlisten {
  const roh = (wert ?? {}) as { trommeln?: unknown; reihen?: unknown };

  const trommeln = (Array.isArray(roh.trommeln) ? roh.trommeln : [])
    .filter(
      (eintrag): eintrag is Trommel =>
        !!eintrag && benannt((eintrag as Trommel).name) && positiv((eintrag as Trommel).radiusMm),
    )
    .map((eintrag) => ({ name: eintrag.name.trim(), radiusMm: eintrag.radiusMm }));

  const reihen = (Array.isArray(roh.reihen) ? roh.reihen : [])
    .filter(
      (eintrag): eintrag is Federreihe =>
        !!eintrag &&
        benannt((eintrag as Federreihe).name) &&
        positiv((eintrag as Federreihe).innenMm),
    )
    .map((eintrag) => ({
      name: eintrag.name.trim(),
      innenMm: eintrag.innenMm,
      drahtstaerken: (Array.isArray(eintrag.drahtstaerken) ? eintrag.drahtstaerken : [])
        .filter(positiv)
        .sort((a, b) => a - b),
    }));

  return {
    trommeln: trommeln.length > 0 ? trommeln : TROMMELN_VORGABE,
    reihen: reihen.length > 0 ? reihen : REIHEN_VORGABE,
  };
}

/** Eine Feder, soweit sie für die Rechnung zählt. */
export interface Feder {
  /** Drahtstärke in mm. */
  drahtMm: number;
  /** Mittlerer Windungsdurchmesser in mm (innen + Draht, außen − Draht). */
  mittelMm: number;
  /** Anzahl der federnden Windungen. */
  windungen: number;
}

/* Maße ineinander umrechnen ---------------------------------------------- */

/** Mittlerer Durchmesser aus dem Innendurchmesser. */
export function mittelAusInnen(innenMm: number, drahtMm: number): number {
  return innenMm + drahtMm;
}

/** Mittlerer Durchmesser aus dem Außendurchmesser. */
export function mittelAusAussen(aussenMm: number, drahtMm: number): number {
  return aussenMm - drahtMm;
}

/**
 * Drahtstärke aus einer Sammelmessung.
 *
 * Eine einzelne Windung mit dem Messschieber zu messen, ist zu ungenau: Die
 * Drahtstärke geht mit der vierten Potenz in die Federrate ein, ein halber
 * Millimeter Irrtum bei 5 mm verschiebt sie um 45 %. Zwanzig Windungen
 * zusammenschieben, über alle messen, teilen.
 */
export function drahtAusMessung(gesamtMm: number, anzahlWindungen: number): number {
  return gesamtMm / anzahlWindungen;
}

/** Windungszahl aus der Baulänge – die Windungen liegen aneinander. */
export function windungenAusLaenge(laengeMm: number, drahtMm: number): number {
  return laengeMm / drahtMm;
}

/** Baulänge des Federkörpers ohne Spannköpfe. */
export function baulaenge(feder: Feder): number {
  return feder.windungen * feder.drahtMm;
}

/**
 * Wickelverhältnis (Federindex) w = mittlerer Durchmesser / Drahtstärke.
 *
 * Unter etwa 4 läßt sich die Feder kaum noch sauber wickeln, über etwa 15 wird
 * sie unruhig. Bei Torfedern liegt es meist zwischen 8 und 13.
 */
export function wickelverhaeltnis(feder: Feder): number {
  return feder.mittelMm / feder.drahtMm;
}

/* Was die Feder leistet -------------------------------------------------- */

/**
 * Drehmoment je Umdrehung in Nm.
 *
 *     M = π · E · d⁴ / (32 · Dm · n)
 *
 * Die vierte Potenz der Drahtstärke ist der Grund, warum beim Ausmessen alles
 * an ihr hängt.
 */
export function federrate(feder: Feder): number {
  const nmm = (Math.PI * E_MODUL * feder.drahtMm ** 4) / (32 * feder.mittelMm * feder.windungen);
  return nmm / 1000;
}

/** Drehmoment nach einer bestimmten Zahl Spannumdrehungen, in Nm. */
export function moment(feder: Feder, umdrehungen: number): number {
  return federrate(feder) * umdrehungen;
}

/**
 * Spannungsbeiwert für die Innenfaser nach DIN EN 13906-3.
 *
 * Im gekrümmten Draht liegt die Spannung innen höher als die einfache
 * Balkenrechnung ergibt. Bei den bei Torfedern üblichen Wickelverhältnissen
 * sind das 6 bis 10 Prozent – wenig, aber genau dort bricht die Feder.
 */
export function spannungsbeiwert(w: number): number {
  return (4 * w ** 2 - w - 1) / (4 * w * (w - 1));
}

/**
 * Biegespannung im Draht bei gegebener Aufdrehung, in N/mm².
 *
 * Die einfache Form σ = 32·M/(π·d³) läßt sich zu
 *
 *     σ = E · d · Δn / (Dm · n)
 *
 * kürzen, und daran sieht man das Entscheidende ohne Rechnung: Die Spannung
 * hängt **nicht** vom Drehmoment ab, sondern nur davon, wie weit man eine
 * gegebene Feder aufdreht. Eine längere Feder mit mehr Windungen leistet
 * dasselbe bei geringerer Spannung – und hält deshalb länger.
 */
export function biegespannung(
  feder: Feder,
  umdrehungen: number,
): { roh: number; korrigiert: number; beiwert: number } {
  const roh = (E_MODUL * feder.drahtMm * umdrehungen) / (feder.mittelMm * feder.windungen);
  const beiwert = spannungsbeiwert(wickelverhaeltnis(feder));

  return { roh, korrigiert: roh * beiwert, beiwert };
}

/* Werkstoff -------------------------------------------------------------- */

export type Guete = 'DH' | 'VDC' | 'VDSiCr';

export const GUETEN: Record<Guete, string> = {
  DH: 'Patentiert-gezogen (EN 10270-1, DH)',
  VDC: 'Ölschlussvergütet (EN 10270-2, VDC)',
  VDSiCr: 'Ölschlussvergütet Chrom-Silizium (EN 10270-2, VDSiCr)',
};

/**
 * Richtwerte der Zugfestigkeit über der Drahtstärke.
 *
 * Federdraht wird beim Ziehen fester, je dünner er ist – ein 3-mm-Draht trägt
 * deutlich mehr je Quadratmillimeter als ein 8-mm-Draht. Die Werte hier sind
 * **Richtwerte zur Einordnung**, keine Abnahmewerte: Maßgeblich ist das Zeugnis
 * des Drahtherstellers. Deshalb läßt sich der Wert in der Oberfläche
 * überschreiben.
 */
const ZUGFESTIGKEIT: Record<Guete, Array<[number, number]>> = {
  DH: [
    [1.0, 2220],
    [2.0, 2020],
    [3.0, 1890],
    [4.0, 1800],
    [5.0, 1730],
    [6.0, 1670],
    [7.0, 1620],
    [8.0, 1580],
    [10.0, 1510],
  ],
  VDC: [
    [1.0, 1980],
    [2.0, 1790],
    [3.0, 1710],
    [4.0, 1660],
    [5.0, 1620],
    [6.0, 1580],
    [7.0, 1550],
    [8.0, 1520],
    [10.0, 1470],
  ],
  VDSiCr: [
    [1.0, 2200],
    [2.0, 2080],
    [3.0, 2000],
    [4.0, 1960],
    [5.0, 1920],
    [6.0, 1890],
    [7.0, 1860],
    [8.0, 1840],
    [10.0, 1800],
  ],
};

/** Zugfestigkeit als Richtwert, zwischen den Stützstellen linear. */
export function zugfestigkeit(drahtMm: number, guete: Guete = 'DH'): number {
  const tabelle = ZUGFESTIGKEIT[guete];
  const erste = tabelle[0];
  const letzte = tabelle[tabelle.length - 1];

  if (drahtMm <= erste[0]) return erste[1];
  if (drahtMm >= letzte[0]) return letzte[1];

  for (let i = 1; i < tabelle.length; i++) {
    const [oberD, oberR] = tabelle[i];
    if (drahtMm > oberD) continue;
    const [unterD, unterR] = tabelle[i - 1];
    const anteil = (drahtMm - unterD) / (oberD - unterD);
    return Math.round(unterR + anteil * (oberR - unterR));
  }

  return letzte[1];
}

/* Beurteilung ------------------------------------------------------------ */

export type Ton = 'gut' | 'knapp' | 'kritisch';

export interface Beurteilung {
  /** Spannung als Anteil der Zugfestigkeit, in Prozent. */
  ausnutzung: number;
  ton: Ton;
  satz: string;
}

/**
 * Ordnet die Spannung ein.
 *
 * Der Bezug ist die zulässige statische Spannung nach DIN EN 13906-3, also
 * 70 % der Zugfestigkeit. Was diese Rechnung **nicht** liefert, ist eine
 * Zyklenzahl: Dafür braucht es das Dauerfestigkeitsschaubild des
 * Drahtherstellers, nicht eine Formel. Genau daran scheitern die frei
 * zugänglichen Rechner, die eine Lebensdauer versprechen.
 *
 * Torfedern liegen im Betrieb regelmäßig über der statisch zulässigen
 * Spannung. Das ist keine Schlamperei, sondern die Bauart: Eine Feder mit
 * reichlich Reserve wäre für die Welle zu lang. Deshalb sind Torfedern
 * Verschleißteile mit Zyklenangabe – und deshalb ist der Weg zu mehr Zyklen
 * eine **größere** Feder bei gleichem Moment, nicht eine stärkere.
 */
export function beurteilen(spannungNmm2: number, zugfestigkeitNmm2: number): Beurteilung {
  const ausnutzung = (spannungNmm2 / zugfestigkeitNmm2) * 100;
  const grenze = ZULAESSIG_STATISCH * 100;

  if (ausnutzung <= grenze) {
    return {
      ausnutzung,
      ton: 'gut',
      satz:
        `Unter der statisch zulässigen Spannung (${grenze} % der Zugfestigkeit ` +
        'nach DIN EN 13906-3). Reichlich Reserve, hohe Zyklenzahl zu erwarten.',
    };
  }

  if (ausnutzung <= 100) {
    return {
      ausnutzung,
      ton: 'knapp',
      satz:
        `Über der statisch zulässigen Spannung von ${grenze} %, aber unter der ` +
        'Zugfestigkeit. In diesem Bereich liegen die meisten Torfedern – sie sind ' +
        'deshalb Verschleißteile. Mehr Zyklen bringt eine längere Feder oder ein ' +
        'größerer Windungsdurchmesser bei gleichem Moment, nicht ein dickerer Draht.',
    };
  }

  return {
    ausnutzung,
    ton: 'kritisch',
    satz:
      'Über der Zugfestigkeit des Drahtes. Die Feder nimmt bleibende Verformung ' +
      'oder bricht früh. Maße prüfen – und wenn sie stimmen, ist diese Feder für ' +
      'diese Anlage zu klein.',
  };
}

/* Die Torseite ----------------------------------------------------------- */

/**
 * Drehmoment, das die Welle aufbringen muß, in Nm.
 *
 * Am Seil hängt das Torblatt, die Trommel setzt die Kraft in ein Moment um.
 */
export function haltemoment(gewichtKg: number, trommelRadiusMm: number): number {
  return gewichtKg * G * (trommelRadiusMm / 1000);
}

/**
 * Umdrehungen, die die Welle über den ganzen Torweg macht.
 *
 * Das Seil wickelt sich über die Torhöhe auf die Trommel: Torhöhe geteilt durch
 * den Trommelumfang.
 */
export function hubUmdrehungen(hoeheMm: number, trommelRadiusMm: number): number {
  return hoeheMm / (2 * Math.PI * trommelRadiusMm);
}

/**
 * Torgewicht, das eine Feder(gruppe) bei gegebener Aufdrehung trägt, in kg.
 *
 * Die Gegenrichtung zum Auslegen: Was hält die Feder, die vor mir liegt?
 */
export function tragfaehigkeit(
  feder: Feder,
  umdrehungen: number,
  trommelRadiusMm: number,
  anzahlFedern = 1,
): number {
  const gesamt = moment(feder, umdrehungen) * anzahlFedern;
  return gesamt / (G * (trommelRadiusMm / 1000));
}

/* Auslegen --------------------------------------------------------------- */

export interface Vorgabe {
  gewichtKg: number;
  hoeheMm: number;
  trommelRadiusMm: number;
  anzahlFedern: number;
  /** Innendurchmesser der Feder in mm – meist durch die Welle vorgegeben. */
  innenMm: number;
  /**
   * Zusätzliche Vorspannung über den Hub hinaus, in Umdrehungen. Ohne sie wäre
   * die Feder am oberen Anschlag völlig entspannt und die Seile lose.
   */
  reserveUmdrehungen: number;
  /** Platz auf der Welle je Feder in mm; ohne Angabe ohne Begrenzung. */
  maxLaengeMm?: number;
  /**
   * Drahtstärken, die gerechnet werden sollen. Ohne Angabe alle
   * handelsüblichen – mit Angabe nur, was die gewählte Reihe führt.
   */
  drahtstaerken?: number[];
  guete: Guete;
}

export interface Vorschlag {
  drahtMm: number;
  /** Auf ganze Windungen gerundet – so wird gewickelt. */
  windungen: number;
  baulaengeMm: number;
  /** Nm je Umdrehung. */
  rateNm: number;
  spannUmdrehungen: number;
  /** Erreichtes Moment je Feder in Nm. */
  momentNm: number;
  /** Getragenes Gewicht über alle Federn in kg. */
  traegtKg: number;
  spannungNmm2: number;
  zugfestigkeitNmm2: number;
  beurteilung: Beurteilung;
  /** Baulänge liegt im vorgegebenen Rahmen. */
  passtAufWelle: boolean;
}

/**
 * Schlägt für jede handelsübliche Drahtstärke die passende Windungszahl vor.
 *
 * Bewußt eine Liste statt eines einzelnen Ergebnisses: Welche Feder in Frage
 * kommt, entscheidet nicht die Rechnung allein, sondern auch der Platz auf der
 * Welle und das, was der Lieferant führt. Die Rechnung sagt, was jede Wahl
 * bedeutet – ausgesucht wird sie im Betrieb.
 */
export function auslegen(vorgabe: Vorgabe): Vorschlag[] {
  const spannUmdrehungen =
    hubUmdrehungen(vorgabe.hoeheMm, vorgabe.trommelRadiusMm) + vorgabe.reserveUmdrehungen;

  const momentJeFeder =
    haltemoment(vorgabe.gewichtKg, vorgabe.trommelRadiusMm) / vorgabe.anzahlFedern;
  const rateSoll = momentJeFeder / spannUmdrehungen; // Nm je Umdrehung

  const staerken =
    vorgabe.drahtstaerken && vorgabe.drahtstaerken.length > 0
      ? [...vorgabe.drahtstaerken].sort((a, b) => a - b)
      : DRAHTSTAERKEN;

  return staerken.map((drahtMm) => {
    const mittelMm = mittelAusInnen(vorgabe.innenMm, drahtMm);

    // Windungszahl aus der geforderten Rate – dann auf ganze Windungen runden
    // und mit dem gerundeten Wert weiterrechnen, sonst stimmt der Bericht
    // nicht mit der Feder überein, die man bestellt.
    const genau = (Math.PI * E_MODUL * drahtMm ** 4) / (32 * mittelMm * rateSoll * 1000);
    const windungen = Math.max(1, Math.round(genau));

    const feder: Feder = { drahtMm, mittelMm, windungen };
    const spannung = biegespannung(feder, spannUmdrehungen);
    const festigkeit = zugfestigkeit(drahtMm, vorgabe.guete);
    const laenge = baulaenge(feder);

    return {
      drahtMm,
      windungen,
      baulaengeMm: laenge,
      rateNm: federrate(feder),
      spannUmdrehungen,
      momentNm: moment(feder, spannUmdrehungen),
      traegtKg: tragfaehigkeit(
        feder,
        spannUmdrehungen,
        vorgabe.trommelRadiusMm,
        vorgabe.anzahlFedern,
      ),
      spannungNmm2: spannung.korrigiert,
      zugfestigkeitNmm2: festigkeit,
      beurteilung: beurteilen(spannung.korrigiert, festigkeit),
      passtAufWelle: vorgabe.maxLaengeMm == null || laenge <= vorgabe.maxLaengeMm,
    };
  });
}
