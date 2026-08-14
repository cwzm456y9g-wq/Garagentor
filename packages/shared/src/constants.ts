import { DoorType, OperationMode } from './enums';

/** In Deutschland gültige Umsatzsteuersätze. */
export const VAT_RATES = [0, 7, 19] as const;
export const DEFAULT_VAT_RATE = 19;

/** Standard-Zahlungsziel in Tagen, wenn beim Kunden nichts hinterlegt ist. */
export const DEFAULT_PAYMENT_TERMS_DAYS = 14;

/** Gültigkeitsdauer eines Angebots in Tagen. */
export const DEFAULT_QUOTE_VALIDITY_DAYS = 30;

/**
 * Prüffrist für kraftbetätigte Tore: mindestens jährlich durch eine
 * sachkundige Person (ASR A1.7 Abschnitt 10, DGUV Information 208-022).
 */
export const INSPECTION_INTERVAL_MONTHS = 12;

/** Vorlaufzeit, ab der eine anstehende Prüfung als "fällig" gemeldet wird. */
export const INSPECTION_DUE_SOON_DAYS = 30;

/** Standardintervall eines Wartungsvertrags in Monaten. */
export const DEFAULT_MAINTENANCE_INTERVAL_MONTHS = 12;

/**
 * Grenzwerte der Schließkraftmessung nach DIN EN 12453 an der Hauptschließkante.
 * Werte in Newton bzw. Millisekunden.
 */
export const CLOSING_FORCE_LIMITS = {
  /** Dynamische Kraft F_d – Spitzenwert. */
  maxDynamicForceN: 400,
  /** Nach 750 ms darf die Restkraft F_s diesen Wert nicht überschreiten. */
  maxRemainingForceN: 150,
  /** Zeitspanne, in der die dynamische Kraft abgebaut sein muss. */
  maxDynamicDurationMs: 750,
  /** Gesamtdauer der Kraftbeaufschlagung. */
  maxTotalDurationMs: 5000,
} as const;

export interface InspectionCheckDefinition {
  /** Stabiler Schlüssel, wird im Prüfprotokoll gespeichert. */
  key: string;
  /** Prüfgruppe für die Gliederung des Protokolls. */
  group: string;
  /** Prüfpunkt im Klartext. */
  label: string;
  /** Regelwerk-Bezug für den Ausdruck. */
  reference: string;
  /** Nur bei kraftbetätigten Toren zu prüfen. */
  poweredOnly?: boolean;
  /** Erfordert die Eingabe eines Messwerts (z. B. Kraftmessung). */
  measurement?: { unit: string; limit?: number };
}

/**
 * Prüfkatalog für die wiederkehrende Prüfung von Toren nach ASR A1.7
 * ("Türen und Tore") in Verbindung mit DIN EN 12604/12453 und der
 * DGUV Information 208-022. Dient als Vorlage; ein Prüfprotokoll speichert
 * die tatsächlich geprüften Punkte als eigene Datensätze.
 */
export const ASR_A17_CHECK_CATALOG: readonly InspectionCheckDefinition[] = [
  {
    key: 'DOKU_UNTERLAGEN',
    group: 'Dokumentation',
    label: 'Technische Unterlagen, Montageanleitung und Prüfbuch vorhanden',
    reference: 'ASR A1.7 Abs. 10',
  },
  {
    key: 'DOKU_KENNZEICHNUNG',
    group: 'Dokumentation',
    label: 'CE-Kennzeichnung und Typenschild vorhanden und lesbar',
    reference: 'DIN EN 13241',
  },
  {
    key: 'DOKU_VORMAENGEL',
    group: 'Dokumentation',
    label: 'Mängel der Vorprüfung nachweislich behoben',
    reference: 'ASR A1.7 Abs. 10',
  },
  {
    key: 'BAU_TORBLATT',
    group: 'Bauteile',
    label: 'Torblatt/Behang auf Verformung, Korrosion und Beschädigung geprüft',
    reference: 'DIN EN 12604',
  },
  {
    key: 'BAU_FUEHRUNG',
    group: 'Bauteile',
    label: 'Laufschienen, Rollen und Führungen auf Verschleiß und Befestigung geprüft',
    reference: 'DIN EN 12604',
  },
  {
    key: 'BAU_BEFESTIGUNG',
    group: 'Bauteile',
    label: 'Befestigung der Anlage am Baukörper geprüft',
    reference: 'DIN EN 12604',
  },
  {
    key: 'BAU_FEDERN',
    group: 'Gewichtsausgleich',
    label: 'Federn auf Bruch, Korrosion und Vorspannung geprüft',
    reference: 'DIN EN 12604',
  },
  {
    key: 'SICH_FEDERBRUCH',
    group: 'Sicherungen',
    label: 'Federbruchsicherung vorhanden und funktionsfähig',
    reference: 'DIN EN 12604',
  },
  {
    key: 'SICH_SEILBRUCH',
    group: 'Sicherungen',
    label: 'Seilbruchsicherung / Absturzsicherung funktionsfähig',
    reference: 'ASR A1.7 Abs. 5',
  },
  {
    key: 'SICH_ABSTURZ',
    group: 'Sicherungen',
    label: 'Sicherung gegen Herabfallen des Torblatts wirksam',
    reference: 'ASR A1.7 Abs. 5',
  },
  {
    key: 'SICH_AUSHEBE',
    group: 'Sicherungen',
    label: 'Sicherung gegen Ausheben und Herausfallen aus der Führung',
    reference: 'DIN EN 12604',
  },
  {
    key: 'QUETSCH_HAUPTKANTE',
    group: 'Quetsch- und Scherstellen',
    label: 'Hauptschließkante gesichert bzw. Sicherheitsabstände eingehalten',
    reference: 'ASR A1.7 Abs. 5, DIN EN 12453',
  },
  {
    key: 'QUETSCH_NEBENKANTE',
    group: 'Quetsch- und Scherstellen',
    label: 'Neben- und Gegenschließkanten gesichert',
    reference: 'DIN EN 12453',
  },
  {
    key: 'QUETSCH_EINZUG',
    group: 'Quetsch- und Scherstellen',
    label: 'Einzugstellen an Rollen, Ketten und Seilen gesichert',
    reference: 'ASR A1.7 Abs. 5',
  },
  {
    key: 'ANTRIEB_BEFESTIGUNG',
    group: 'Antrieb',
    label: 'Antrieb sicher befestigt, Kette/Zahnriemen korrekt gespannt',
    reference: 'DIN EN 12453',
    poweredOnly: true,
  },
  {
    key: 'ANTRIEB_ENDLAGEN',
    group: 'Antrieb',
    label: 'Endlagen korrekt eingestellt, Endschalter funktionsfähig',
    reference: 'DIN EN 12453',
    poweredOnly: true,
  },
  {
    key: 'ANTRIEB_NOTENTRIEGELUNG',
    group: 'Antrieb',
    label: 'Notentriegelung vorhanden, gekennzeichnet und funktionsfähig',
    reference: 'ASR A1.7 Abs. 9',
    poweredOnly: true,
  },
  {
    key: 'ANTRIEB_TOTMANN',
    group: 'Antrieb',
    label: 'Totmannschaltung bzw. Befehlsgeber in Sichtweite des Tores',
    reference: 'DIN EN 12453',
    poweredOnly: true,
  },
  {
    key: 'SCHUTZ_LICHTSCHRANKE',
    group: 'Schutzeinrichtungen',
    label: 'Lichtschranke / Lichtgitter funktionsfähig und richtig ausgerichtet',
    reference: 'DIN EN 12453',
    poweredOnly: true,
  },
  {
    key: 'SCHUTZ_SCHALTLEISTE',
    group: 'Schutzeinrichtungen',
    label: 'Schaltleiste (Sicherheitskontaktleiste) reagiert einwandfrei',
    reference: 'DIN EN 12978',
    poweredOnly: true,
  },
  {
    key: 'SCHUTZ_KRAFTBEGRENZUNG',
    group: 'Schutzeinrichtungen',
    label: 'Kraftbegrenzung wirksam, Tor reversiert bei Hindernis',
    reference: 'DIN EN 12453',
    poweredOnly: true,
  },
  {
    key: 'MESS_KRAFT_DYNAMISCH',
    group: 'Kraftmessung',
    label: 'Dynamische Schließkraft F_d an der Hauptschließkante',
    reference: 'DIN EN 12453 Tab. 3',
    poweredOnly: true,
    measurement: { unit: 'N', limit: CLOSING_FORCE_LIMITS.maxDynamicForceN },
  },
  {
    key: 'MESS_KRAFT_REST',
    group: 'Kraftmessung',
    label: 'Restkraft F_s nach 750 ms',
    reference: 'DIN EN 12453 Tab. 3',
    poweredOnly: true,
    measurement: { unit: 'N', limit: CLOSING_FORCE_LIMITS.maxRemainingForceN },
  },
  {
    key: 'MESS_KRAFT_DAUER',
    group: 'Kraftmessung',
    label: 'Dauer der Kraftbeaufschlagung t_d',
    reference: 'DIN EN 12453 Tab. 3',
    poweredOnly: true,
    measurement: { unit: 'ms', limit: CLOSING_FORCE_LIMITS.maxTotalDurationMs },
  },
  {
    key: 'ELEKTRO_LEITUNGEN',
    group: 'Elektrik',
    label: 'Elektrische Leitungen, Steckverbindungen und Gehäuse unbeschädigt',
    reference: 'DGUV V3',
    poweredOnly: true,
  },
  {
    key: 'ELEKTRO_HAUPTSCHALTER',
    group: 'Elektrik',
    label: 'Hauptschalter / Not-Halt erreichbar und wirksam',
    reference: 'ASR A1.7 Abs. 9',
    poweredOnly: true,
  },
  {
    key: 'UMFELD_KENNZEICHNUNG',
    group: 'Umfeld',
    label: 'Kennzeichnung von Glasflächen und Durchgängen vorhanden',
    reference: 'ASR A1.7 Abs. 6',
  },
  {
    key: 'UMFELD_FLUCHTWEG',
    group: 'Umfeld',
    label: 'Anforderungen an Tore in Fluchtwegen erfüllt',
    reference: 'ASR A1.7 Abs. 8',
  },
  {
    key: 'UMFELD_BELEUCHTUNG',
    group: 'Umfeld',
    label: 'Ausreichende Beleuchtung im Torbereich',
    reference: 'ASR A3.4',
  },
  {
    key: 'FUNKTION_PROBELAUF',
    group: 'Funktion',
    label: 'Probelauf ohne ungewöhnliche Geräusche, Laufruhe in Ordnung',
    reference: 'DIN EN 12604',
  },
  {
    key: 'FUNKTION_HANDBETRIEB',
    group: 'Funktion',
    label: 'Handbetrieb möglich, Betätigungskraft zumutbar',
    reference: 'ASR A1.7 Abs. 4',
  },
];

/** Liefert den Prüfkatalog passend zur Betriebsart der Anlage. */
export function checkCatalogFor(operationMode: OperationMode): InspectionCheckDefinition[] {
  return ASR_A17_CHECK_CATALOG.filter(
    (check) => !check.poweredOnly || operationMode === OperationMode.KRAFTBETAETIGT,
  );
}

/** Tortypen, die üblicherweise kraftbetätigt ausgeführt werden. */
export const TYPICALLY_POWERED_DOOR_TYPES: readonly DoorType[] = [
  DoorType.SCHNELLLAUFTOR,
  DoorType.INDUSTRIETOR,
  DoorType.ROLLTOR,
  DoorType.SCHIEBETOR,
  DoorType.SCHRANKE,
];

/**
 * Zinspunkte über dem Basiszinssatz nach § 288 BGB. Die neun Punkte gelten nur
 * bei Entgeltforderungen, an denen kein Verbraucher beteiligt ist.
 */
export const INTEREST_POINTS = {
  VERBRAUCHER: 5,
  UNTERNEHMEN: 9,
} as const;

/**
 * Basiszinssatz nach § 247 BGB. Die Deutsche Bundesbank gibt ihn zum 1. Januar
 * und 1. Juli neu bekannt – der Wert hier ist nur eine Vorbelegung und gehört
 * in den Einstellungen gepflegt. Ist er veraltet, weist die Anwendung darauf hin.
 */
export const DEFAULT_BASE_RATE = {
  percent: 1.27,
  validFrom: '2025-07-01',
} as const;

/** Voreinstellungen für den Mahnlauf. */
export const DUNNING_DEFAULTS = [
  { level: 'ZAHLUNGSERINNERUNG', daysOverdue: 3, fee: 0, zinsen: false, graceDays: 7 },
  { level: 'MAHNUNG_1', daysOverdue: 14, fee: 5, zinsen: true, graceDays: 7 },
  { level: 'MAHNUNG_2', daysOverdue: 28, fee: 10, zinsen: true, graceDays: 7 },
  { level: 'LETZTE_MAHNUNG', daysOverdue: 42, fee: 15, zinsen: true, graceDays: 5 },
] as const;

/**
 * Anschreiben der Mahnstufen.
 *
 * Der Ton steigt bewusst von Stufe zu Stufe: die Zahlungserinnerung geht davon
 * aus, dass etwas übersehen wurde, die letzte Mahnung kündigt konkrete Schritte
 * an. `{frist}` wird beim Setzen durch das Zahlungsziel ersetzt.
 */
export const DUNNING_TEXTS: Record<string, { anschreiben: string; schluss: string }> = {
  ZAHLUNGSERINNERUNG: {
    anschreiben:
      'vermutlich ist es Ihrer Aufmerksamkeit entgangen: die unten aufgeführte Rechnung ist ' +
      'noch offen. Sollten Sie den Betrag zwischenzeitlich überwiesen haben, betrachten Sie ' +
      'dieses Schreiben bitte als gegenstandslos.',
    schluss: 'Wir bitten Sie, den offenen Betrag bis zum {frist} auszugleichen.',
  },
  MAHNUNG_1: {
    anschreiben:
      'trotz unserer Zahlungserinnerung ist die unten aufgeführte Rechnung weiterhin offen. ' +
      'Sie befinden sich damit in Verzug. Wir berechnen daher die gesetzlichen Verzugszinsen ' +
      'nach § 288 BGB sowie eine Mahngebühr.',
    schluss: 'Bitte gleichen Sie den Gesamtbetrag bis zum {frist} aus.',
  },
  MAHNUNG_2: {
    anschreiben:
      'auf unsere erste Mahnung haben wir bislang keinen Zahlungseingang feststellen können. ' +
      'Wir fordern Sie hiermit erneut auf, die offene Forderung zu begleichen.',
    schluss: 'Der Gesamtbetrag ist bis zum {frist} bei uns gutzuschreiben.',
  },
  LETZTE_MAHNUNG: {
    anschreiben:
      'dies ist unsere letzte Mahnung. Geht bis zum genannten Termin keine Zahlung ein, geben ' +
      'wir die Forderung ohne weitere Ankündigung ab und leiten das gerichtliche Mahnverfahren ' +
      'ein. Die dadurch entstehenden Kosten haben Sie zu tragen.',
    schluss: 'Wir erwarten Ihre Zahlung bis spätestens zum {frist}.',
  },
  INKASSO: {
    anschreiben:
      'die offene Forderung haben wir zur weiteren Bearbeitung abgegeben. Zahlungen mit ' +
      'schuldbefreiender Wirkung können nur noch an die dort genannte Stelle geleistet werden.',
    schluss: 'Für Rückfragen wenden Sie sich bitte an die bearbeitende Stelle.',
  },
};

/* Postausgang ---------------------------------------------------------- */

/** Belegarten, die sich per Mail verschicken lassen. */
export const MAIL_DOCUMENT_TYPES = [
  'ANGEBOT',
  'RECHNUNG',
  'MAHNUNG',
  'SERVICEBERICHT',
  'PRUEFBESCHEINIGUNG',
  'PRUEFPROTOKOLL',
] as const;

export type MailDocumentType = (typeof MAIL_DOCUMENT_TYPES)[number];

/**
 * Platzhalter in Betreff und Text der Vorlagen. Was hier nicht steht, bleibt
 * beim Setzen unverändert stehen – ein Tippfehler fällt so im Entwurf auf,
 * statt beim Kunden zu landen.
 */
export const MAIL_PLACEHOLDERS: Array<{ name: string; beschreibung: string }> = [
  { name: '{anrede}', beschreibung: 'Sehr geehrte Frau Meier,' },
  { name: '{kunde}', beschreibung: 'Name des Kunden' },
  { name: '{nummer}', beschreibung: 'Belegnummer' },
  { name: '{betreff}', beschreibung: 'Betreff des Belegs' },
  { name: '{datum}', beschreibung: 'Belegdatum' },
  { name: '{betrag}', beschreibung: 'Bruttobetrag bzw. Gesamtforderung' },
  { name: '{faellig}', beschreibung: 'Zahlungsziel bzw. Frist' },
  { name: '{stufe}', beschreibung: 'Mahnstufe' },
  { name: '{anlage}', beschreibung: 'Toranlage mit Standort' },
  { name: '{firma}', beschreibung: 'Name des eigenen Betriebs' },
];

/** Voreingestellte Anschreiben für den Belegversand. */
export const MAIL_TEMPLATE_DEFAULTS: Record<MailDocumentType, { betreff: string; text: string }> = {
  ANGEBOT: {
    betreff: 'Angebot {nummer} – {betreff}',
    text:
      '{anrede}\n\n' +
      'vielen Dank für Ihre Anfrage. Im Anhang finden Sie unser Angebot {nummer} ' +
      'über {betrag}.\n\n' +
      'Für Rückfragen stehen wir Ihnen gerne zur Verfügung.',
  },
  RECHNUNG: {
    betreff: 'Rechnung {nummer} – {betreff}',
    text:
      '{anrede}\n\n' +
      'anbei erhalten Sie unsere Rechnung {nummer} vom {datum} über {betrag}.\n' +
      'Wir bitten um Ausgleich bis zum {faellig}.\n\n' +
      'Vielen Dank für Ihren Auftrag.',
  },
  MAHNUNG: {
    betreff: '{stufe} zu Rechnung {nummer}',
    text:
      '{anrede}\n\n' +
      'im Anhang finden Sie unsere {stufe} zu Rechnung {nummer} über {betrag}.\n' +
      'Wir bitten um Ausgleich bis zum {faellig}.',
  },
  SERVICEBERICHT: {
    betreff: 'Servicebericht {nummer} – {anlage}',
    text:
      '{anrede}\n\n' +
      'anbei erhalten Sie den Servicebericht {nummer} zu unserem Einsatz am {datum} ' +
      'an der Anlage {anlage}.',
  },
  PRUEFBESCHEINIGUNG: {
    betreff: 'Prüfbescheinigung {nummer} – {anlage}',
    text:
      '{anrede}\n\n' +
      'anbei erhalten Sie die Bescheinigung über die Prüfung vom {datum} an der Anlage ' +
      '{anlage}.\n\n' +
      'Die nächste Prüfung ist bis zum {faellig} fällig. Bitte bewahren Sie die ' +
      'Bescheinigung bis dahin auf; sie ist auf Verlangen der Aufsichtsbehörde ' +
      'vorzulegen.\n\n' +
      'Das ausführliche Prüfprotokoll mit allen Einzelprüfpunkten liegt bei uns vor und ' +
      'wird Ihnen auf Wunsch ausgehändigt.',
  },
  PRUEFPROTOKOLL: {
    betreff: 'Prüfprotokoll {nummer} – {anlage}',
    text:
      '{anrede}\n\n' +
      'anbei erhalten Sie das Prüfprotokoll {nummer} zur Prüfung vom {datum} an der ' +
      'Anlage {anlage}.\n\n' +
      'Bitte bewahren Sie das Protokoll bis zur nächsten Prüfung auf; es ist auf ' +
      'Verlangen der Aufsichtsbehörde vorzulegen.',
  },
};

/* Buchhaltung ---------------------------------------------------------- */

/**
 * Erlöskonten der gängigen Kontenrahmen, nach Steuersatz.
 *
 * Es sind Automatikkonten: der Steuerschlüssel ergibt sich in DATEV aus dem
 * Konto, deshalb bleibt das Feld BU-Schlüssel im Export leer. Wer eigene
 * Konten führt, überschreibt sie in den Einstellungen.
 */
export const CHART_OF_ACCOUNTS = {
  SKR03: { name: 'SKR03', erloese: { 19: 8400, 7: 8300, 0: 8200 }, debitorBasis: 10000 },
  SKR04: { name: 'SKR04', erloese: { 19: 4400, 7: 4300, 0: 4200 }, debitorBasis: 10000 },
} as const;

export type ChartOfAccounts = keyof typeof CHART_OF_ACCOUNTS;

/** Voreinstellungen für den DATEV-Export. */
export const DATEV_DEFAULTS = {
  kontenrahmen: 'SKR03' as ChartOfAccounts,
  /** Beraternummer der Kanzlei; kommt vom Steuerberater. */
  beraternummer: 0,
  mandantennummer: 0,
  /** Stellenzahl der Sachkonten; muss zur Einrichtung der Kanzlei passen. */
  sachkontenlaenge: 4,
  debitorBasis: 10000,
  /**
   * Festgeschriebene Buchungen sind in DATEV nicht mehr änderbar. Beim ersten
   * Export lieber offen lassen, bis die Kanzlei den Stapel geprüft hat.
   */
  festschreibung: false,
  erloeskonten: { 19: 8400, 7: 8300, 0: 8200 } as Record<number, number>,
};

/** Nummernkreise mit Standardpräfix und Stellenzahl. */
export const NUMBER_RANGE_DEFAULTS = [
  { entity: 'CUSTOMER', prefix: 'K-', padding: 5, yearlyReset: false },
  { entity: 'QUOTE', prefix: 'AN-', padding: 4, yearlyReset: true },
  { entity: 'ORDER', prefix: 'AU-', padding: 4, yearlyReset: true },
  { entity: 'INVOICE', prefix: 'RE-', padding: 4, yearlyReset: true },
  { entity: 'SERVICE_REPORT', prefix: 'SB-', padding: 4, yearlyReset: true },
  { entity: 'INSPECTION', prefix: 'PR-', padding: 4, yearlyReset: true },
  { entity: 'PROJECT', prefix: 'P-', padding: 4, yearlyReset: true },
  { entity: 'PURCHASE_ORDER', prefix: 'BE-', padding: 4, yearlyReset: true },
  { entity: 'SUPPLIER', prefix: 'L-', padding: 4, yearlyReset: false },
  { entity: 'ARTICLE', prefix: 'A-', padding: 5, yearlyReset: false },
  { entity: 'DOOR', prefix: 'TOR-', padding: 5, yearlyReset: false },
  { entity: 'EMPLOYEE', prefix: 'MA-', padding: 3, yearlyReset: false },
  { entity: 'MAINTENANCE_CONTRACT', prefix: 'WV-', padding: 4, yearlyReset: true },
] as const;
