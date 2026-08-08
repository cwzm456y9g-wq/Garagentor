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
