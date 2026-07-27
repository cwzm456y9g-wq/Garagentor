/**
 * Domänen-Enums. Die Werte sind identisch mit den Prisma-Enums der API,
 * damit Frontend und Backend ohne Umrechnung dieselben Strings verwenden.
 */

export const Role = {
  ADMIN: 'ADMIN',
  GESCHAEFTSFUEHRUNG: 'GESCHAEFTSFUEHRUNG',
  BUERO: 'BUERO',
  BUCHHALTUNG: 'BUCHHALTUNG',
  MONTEUR: 'MONTEUR',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const CustomerType = {
  PRIVAT: 'PRIVAT',
  GEWERBE: 'GEWERBE',
  OEFFENTLICH: 'OEFFENTLICH',
  HAUSVERWALTUNG: 'HAUSVERWALTUNG',
} as const;
export type CustomerType = (typeof CustomerType)[keyof typeof CustomerType];

export const AddressType = {
  RECHNUNG: 'RECHNUNG',
  LIEFERUNG: 'LIEFERUNG',
  OBJEKT: 'OBJEKT',
} as const;
export type AddressType = (typeof AddressType)[keyof typeof AddressType];

export const Salutation = {
  HERR: 'HERR',
  FRAU: 'FRAU',
  DIVERS: 'DIVERS',
  FIRMA: 'FIRMA',
} as const;
export type Salutation = (typeof Salutation)[keyof typeof Salutation];

export const QuoteStatus = {
  ENTWURF: 'ENTWURF',
  VERSENDET: 'VERSENDET',
  ANGENOMMEN: 'ANGENOMMEN',
  ABGELEHNT: 'ABGELEHNT',
  ABGELAUFEN: 'ABGELAUFEN',
  STORNIERT: 'STORNIERT',
} as const;
export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus];

export const LineItemType = {
  ARTIKEL: 'ARTIKEL',
  LEISTUNG: 'LEISTUNG',
  TEXT: 'TEXT',
  ZWISCHENSUMME: 'ZWISCHENSUMME',
} as const;
export type LineItemType = (typeof LineItemType)[keyof typeof LineItemType];

export const OrderStatus = {
  ANGELEGT: 'ANGELEGT',
  EINGEPLANT: 'EINGEPLANT',
  IN_ARBEIT: 'IN_ARBEIT',
  WARTET_AUF_MATERIAL: 'WARTET_AUF_MATERIAL',
  ABGESCHLOSSEN: 'ABGESCHLOSSEN',
  ABGERECHNET: 'ABGERECHNET',
  STORNIERT: 'STORNIERT',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderType = {
  MONTAGE: 'MONTAGE',
  REPARATUR: 'REPARATUR',
  WARTUNG: 'WARTUNG',
  PRUEFUNG: 'PRUEFUNG',
  NOTDIENST: 'NOTDIENST',
  SONSTIGES: 'SONSTIGES',
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const InvoiceType = {
  RECHNUNG: 'RECHNUNG',
  ABSCHLAGSRECHNUNG: 'ABSCHLAGSRECHNUNG',
  SCHLUSSRECHNUNG: 'SCHLUSSRECHNUNG',
  GUTSCHRIFT: 'GUTSCHRIFT',
} as const;
export type InvoiceType = (typeof InvoiceType)[keyof typeof InvoiceType];

export const InvoiceStatus = {
  ENTWURF: 'ENTWURF',
  OFFEN: 'OFFEN',
  TEILBEZAHLT: 'TEILBEZAHLT',
  BEZAHLT: 'BEZAHLT',
  UEBERFAELLIG: 'UEBERFAELLIG',
  STORNIERT: 'STORNIERT',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const PaymentMethod = {
  UEBERWEISUNG: 'UEBERWEISUNG',
  BAR: 'BAR',
  KARTE: 'KARTE',
  LASTSCHRIFT: 'LASTSCHRIFT',
  PAYPAL: 'PAYPAL',
  VERRECHNUNG: 'VERRECHNUNG',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

/** Mahnstufen nach betrieblicher Praxis (§ 286 BGB Verzug). */
export const DunningLevel = {
  ZAHLUNGSERINNERUNG: 'ZAHLUNGSERINNERUNG',
  MAHNUNG_1: 'MAHNUNG_1',
  MAHNUNG_2: 'MAHNUNG_2',
  LETZTE_MAHNUNG: 'LETZTE_MAHNUNG',
  INKASSO: 'INKASSO',
} as const;
export type DunningLevel = (typeof DunningLevel)[keyof typeof DunningLevel];

export const DunningStatus = {
  ENTWURF: 'ENTWURF',
  VERSENDET: 'VERSENDET',
  ERLEDIGT: 'ERLEDIGT',
  ABGEBROCHEN: 'ABGEBROCHEN',
} as const;
export type DunningStatus = (typeof DunningStatus)[keyof typeof DunningStatus];

/* ------------------------------------------------------------------ */
/* Garagentor-Branchenmodul                                            */
/* ------------------------------------------------------------------ */

export const DoorType = {
  SECTIONALTOR: 'SECTIONALTOR',
  SCHWINGTOR: 'SCHWINGTOR',
  ROLLTOR: 'ROLLTOR',
  ROLLGITTER: 'ROLLGITTER',
  SCHIEBETOR: 'SCHIEBETOR',
  FALTTOR: 'FALTTOR',
  FLUEGELTOR: 'FLUEGELTOR',
  SCHNELLLAUFTOR: 'SCHNELLLAUFTOR',
  FEUERSCHUTZABSCHLUSS: 'FEUERSCHUTZABSCHLUSS',
  INDUSTRIETOR: 'INDUSTRIETOR',
  SCHRANKE: 'SCHRANKE',
} as const;
export type DoorType = (typeof DoorType)[keyof typeof DoorType];

export const OperationMode = {
  HANDBETAETIGT: 'HANDBETAETIGT',
  KRAFTBETAETIGT: 'KRAFTBETAETIGT',
} as const;
export type OperationMode = (typeof OperationMode)[keyof typeof OperationMode];

export const DoorStatus = {
  IN_BETRIEB: 'IN_BETRIEB',
  EINGESCHRAENKT: 'EINGESCHRAENKT',
  AUSSER_BETRIEB: 'AUSSER_BETRIEB',
  STILLGELEGT: 'STILLGELEGT',
} as const;
export type DoorStatus = (typeof DoorStatus)[keyof typeof DoorStatus];

/**
 * Prüfarten für kraftbetätigte Tore nach ASR A1.7 i. V. m. DGUV Information
 * 208-022 und DIN EN 12453 / 12604.
 */
export const InspectionType = {
  ERSTPRUEFUNG: 'ERSTPRUEFUNG',
  WIEDERKEHRENDE_PRUEFUNG: 'WIEDERKEHRENDE_PRUEFUNG',
  AUSSERORDENTLICHE_PRUEFUNG: 'AUSSERORDENTLICHE_PRUEFUNG',
  NACHPRUEFUNG: 'NACHPRUEFUNG',
} as const;
export type InspectionType = (typeof InspectionType)[keyof typeof InspectionType];

export const InspectionResult = {
  BESTANDEN: 'BESTANDEN',
  BESTANDEN_MIT_HINWEISEN: 'BESTANDEN_MIT_HINWEISEN',
  GERINGE_MAENGEL: 'GERINGE_MAENGEL',
  ERHEBLICHE_MAENGEL: 'ERHEBLICHE_MAENGEL',
  NICHT_BESTANDEN: 'NICHT_BESTANDEN',
} as const;
export type InspectionResult = (typeof InspectionResult)[keyof typeof InspectionResult];

export const CheckResult = {
  OK: 'OK',
  MANGEL: 'MANGEL',
  NICHT_ZUTREFFEND: 'NICHT_ZUTREFFEND',
  NICHT_GEPRUEFT: 'NICHT_GEPRUEFT',
} as const;
export type CheckResult = (typeof CheckResult)[keyof typeof CheckResult];

export const DefectSeverity = {
  HINWEIS: 'HINWEIS',
  GERING: 'GERING',
  ERHEBLICH: 'ERHEBLICH',
  GEFAHR_IM_VERZUG: 'GEFAHR_IM_VERZUG',
} as const;
export type DefectSeverity = (typeof DefectSeverity)[keyof typeof DefectSeverity];

export const DefectStatus = {
  OFFEN: 'OFFEN',
  IN_BEARBEITUNG: 'IN_BEARBEITUNG',
  BEHOBEN: 'BEHOBEN',
  AKZEPTIERT: 'AKZEPTIERT',
} as const;
export type DefectStatus = (typeof DefectStatus)[keyof typeof DefectStatus];

export const ServiceReportStatus = {
  ENTWURF: 'ENTWURF',
  ABGESCHLOSSEN: 'ABGESCHLOSSEN',
  ABGERECHNET: 'ABGERECHNET',
} as const;
export type ServiceReportStatus = (typeof ServiceReportStatus)[keyof typeof ServiceReportStatus];

export const MaintenanceContractStatus = {
  AKTIV: 'AKTIV',
  PAUSIERT: 'PAUSIERT',
  GEKUENDIGT: 'GEKUENDIGT',
  ABGELAUFEN: 'ABGELAUFEN',
} as const;
export type MaintenanceContractStatus =
  (typeof MaintenanceContractStatus)[keyof typeof MaintenanceContractStatus];

/* ------------------------------------------------------------------ */
/* Lager, Bestellungen, Planung                                        */
/* ------------------------------------------------------------------ */

export const StockMovementType = {
  ZUGANG: 'ZUGANG',
  ABGANG: 'ABGANG',
  KORREKTUR: 'KORREKTUR',
  INVENTUR: 'INVENTUR',
  UMLAGERUNG: 'UMLAGERUNG',
  RETOURE: 'RETOURE',
} as const;
export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType];

export const PurchaseOrderStatus = {
  ENTWURF: 'ENTWURF',
  BESTELLT: 'BESTELLT',
  TEILGELIEFERT: 'TEILGELIEFERT',
  GELIEFERT: 'GELIEFERT',
  STORNIERT: 'STORNIERT',
} as const;
export type PurchaseOrderStatus = (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus];

export const AppointmentType = {
  MONTAGE: 'MONTAGE',
  WARTUNG: 'WARTUNG',
  PRUEFUNG: 'PRUEFUNG',
  REPARATUR: 'REPARATUR',
  AUFMASS: 'AUFMASS',
  BERATUNG: 'BERATUNG',
  INTERN: 'INTERN',
} as const;
export type AppointmentType = (typeof AppointmentType)[keyof typeof AppointmentType];

export const AppointmentStatus = {
  GEPLANT: 'GEPLANT',
  BESTAETIGT: 'BESTAETIGT',
  UNTERWEGS: 'UNTERWEGS',
  ERLEDIGT: 'ERLEDIGT',
  ABGESAGT: 'ABGESAGT',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const ProjectStatus = {
  PLANUNG: 'PLANUNG',
  LAUFEND: 'LAUFEND',
  PAUSIERT: 'PAUSIERT',
  ABGESCHLOSSEN: 'ABGESCHLOSSEN',
  ABGEBROCHEN: 'ABGEBROCHEN',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const TaskStatus = {
  OFFEN: 'OFFEN',
  IN_ARBEIT: 'IN_ARBEIT',
  ERLEDIGT: 'ERLEDIGT',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TimeEntryType = {
  ARBEITSZEIT: 'ARBEITSZEIT',
  FAHRTZEIT: 'FAHRTZEIT',
  BEREITSCHAFT: 'BEREITSCHAFT',
  URLAUB: 'URLAUB',
  KRANKHEIT: 'KRANKHEIT',
  FEIERTAG: 'FEIERTAG',
  SCHULUNG: 'SCHULUNG',
} as const;
export type TimeEntryType = (typeof TimeEntryType)[keyof typeof TimeEntryType];

/* ------------------------------------------------------------------ */
/* Personal, Dokumente                                                 */
/* ------------------------------------------------------------------ */

export const EmploymentType = {
  VOLLZEIT: 'VOLLZEIT',
  TEILZEIT: 'TEILZEIT',
  MINIJOB: 'MINIJOB',
  AUSZUBILDENDER: 'AUSZUBILDENDER',
  AUSHILFE: 'AUSHILFE',
  FREIER_MITARBEITER: 'FREIER_MITARBEITER',
} as const;
export type EmploymentType = (typeof EmploymentType)[keyof typeof EmploymentType];

export const AbsenceType = {
  URLAUB: 'URLAUB',
  KRANKHEIT: 'KRANKHEIT',
  GLEITZEIT: 'GLEITZEIT',
  SCHULUNG: 'SCHULUNG',
  UNBEZAHLT: 'UNBEZAHLT',
  SONSTIGES: 'SONSTIGES',
} as const;
export type AbsenceType = (typeof AbsenceType)[keyof typeof AbsenceType];

export const AbsenceStatus = {
  BEANTRAGT: 'BEANTRAGT',
  GENEHMIGT: 'GENEHMIGT',
  ABGELEHNT: 'ABGELEHNT',
  STORNIERT: 'STORNIERT',
} as const;
export type AbsenceStatus = (typeof AbsenceStatus)[keyof typeof AbsenceStatus];

export const DocumentCategory = {
  ANGEBOT: 'ANGEBOT',
  AUFTRAG: 'AUFTRAG',
  RECHNUNG: 'RECHNUNG',
  MAHNUNG: 'MAHNUNG',
  PRUEFPROTOKOLL: 'PRUEFPROTOKOLL',
  SERVICEBERICHT: 'SERVICEBERICHT',
  WARTUNGSVERTRAG: 'WARTUNGSVERTRAG',
  FOTO: 'FOTO',
  TECHNISCHE_UNTERLAGE: 'TECHNISCHE_UNTERLAGE',
  PERSONAL: 'PERSONAL',
  SONSTIGES: 'SONSTIGES',
} as const;
export type DocumentCategory = (typeof DocumentCategory)[keyof typeof DocumentCategory];

/** Verknüpfbare Entitäten für Dokumente und die globale Suche. */
export const EntityType = {
  CUSTOMER: 'CUSTOMER',
  SITE: 'SITE',
  QUOTE: 'QUOTE',
  ORDER: 'ORDER',
  INVOICE: 'INVOICE',
  DOOR: 'DOOR',
  INSPECTION: 'INSPECTION',
  SERVICE_REPORT: 'SERVICE_REPORT',
  MAINTENANCE_CONTRACT: 'MAINTENANCE_CONTRACT',
  PROJECT: 'PROJECT',
  EMPLOYEE: 'EMPLOYEE',
  ARTICLE: 'ARTICLE',
  SUPPLIER: 'SUPPLIER',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
} as const;
export type EntityType = (typeof EntityType)[keyof typeof EntityType];
