import {
  AbsenceStatus,
  AbsenceType,
  AppointmentStatus,
  AppointmentType,
  CheckResult,
  CustomerType,
  DefectSeverity,
  DefectStatus,
  DocumentCategory,
  DoorStatus,
  DoorType,
  DunningLevel,
  EmploymentType,
  InspectionResult,
  InspectionType,
  InvoiceStatus,
  InvoiceType,
  LineItemType,
  MaintenanceContractStatus,
  OperationMode,
  OrderStatus,
  OrderType,
  PaymentMethod,
  ProjectStatus,
  PurchaseOrderStatus,
  QuoteStatus,
  Role,
  Salutation,
  StockMovementType,
  TimeEntryType,
} from './enums';

type LabelMap<T extends string> = Record<T, string>;

export const roleLabels: LabelMap<Role> = {
  ADMIN: 'Administrator',
  GESCHAEFTSFUEHRUNG: 'Geschäftsführung',
  BUERO: 'Büro',
  BUCHHALTUNG: 'Buchhaltung',
  MONTEUR: 'Monteur',
};

export const customerTypeLabels: LabelMap<CustomerType> = {
  PRIVAT: 'Privatkunde',
  GEWERBE: 'Gewerbekunde',
  OEFFENTLICH: 'Öffentlicher Auftraggeber',
  HAUSVERWALTUNG: 'Hausverwaltung',
};

export const salutationLabels: LabelMap<Salutation> = {
  HERR: 'Herr',
  FRAU: 'Frau',
  DIVERS: 'Divers',
  FIRMA: 'Firma',
};

export const quoteStatusLabels: LabelMap<QuoteStatus> = {
  ENTWURF: 'Entwurf',
  VERSENDET: 'Versendet',
  ANGENOMMEN: 'Angenommen',
  ABGELEHNT: 'Abgelehnt',
  ABGELAUFEN: 'Abgelaufen',
  STORNIERT: 'Storniert',
};

export const lineItemTypeLabels: LabelMap<LineItemType> = {
  ARTIKEL: 'Artikel',
  LEISTUNG: 'Leistung',
  TEXT: 'Textposition',
  ZWISCHENSUMME: 'Zwischensumme',
};

export const orderStatusLabels: LabelMap<OrderStatus> = {
  ANGELEGT: 'Angelegt',
  EINGEPLANT: 'Eingeplant',
  IN_ARBEIT: 'In Arbeit',
  WARTET_AUF_MATERIAL: 'Wartet auf Material',
  ABGESCHLOSSEN: 'Abgeschlossen',
  ABGERECHNET: 'Abgerechnet',
  STORNIERT: 'Storniert',
};

export const orderTypeLabels: LabelMap<OrderType> = {
  MONTAGE: 'Montage',
  REPARATUR: 'Reparatur',
  WARTUNG: 'Wartung',
  PRUEFUNG: 'Prüfung',
  NOTDIENST: 'Notdienst',
  SONSTIGES: 'Sonstiges',
};

export const invoiceTypeLabels: LabelMap<InvoiceType> = {
  RECHNUNG: 'Rechnung',
  ABSCHLAGSRECHNUNG: 'Abschlagsrechnung',
  SCHLUSSRECHNUNG: 'Schlussrechnung',
  GUTSCHRIFT: 'Gutschrift',
};

export const invoiceStatusLabels: LabelMap<InvoiceStatus> = {
  ENTWURF: 'Entwurf',
  OFFEN: 'Offen',
  TEILBEZAHLT: 'Teilbezahlt',
  BEZAHLT: 'Bezahlt',
  UEBERFAELLIG: 'Überfällig',
  STORNIERT: 'Storniert',
};

export const paymentMethodLabels: LabelMap<PaymentMethod> = {
  UEBERWEISUNG: 'Überweisung',
  BAR: 'Barzahlung',
  KARTE: 'Kartenzahlung',
  LASTSCHRIFT: 'Lastschrift',
  PAYPAL: 'PayPal',
  VERRECHNUNG: 'Verrechnung',
};

export const dunningLevelLabels: LabelMap<DunningLevel> = {
  ZAHLUNGSERINNERUNG: 'Zahlungserinnerung',
  MAHNUNG_1: '1. Mahnung',
  MAHNUNG_2: '2. Mahnung',
  LETZTE_MAHNUNG: 'Letzte Mahnung',
  INKASSO: 'Inkasso',
};

export const doorTypeLabels: LabelMap<DoorType> = {
  SECTIONALTOR: 'Sectionaltor',
  SCHWINGTOR: 'Schwingtor',
  ROLLTOR: 'Rolltor',
  ROLLGITTER: 'Rollgitter',
  SCHIEBETOR: 'Schiebetor',
  FALTTOR: 'Falttor',
  FLUEGELTOR: 'Flügeltor',
  SCHNELLLAUFTOR: 'Schnelllauftor',
  FEUERSCHUTZABSCHLUSS: 'Feuerschutzabschluss',
  INDUSTRIETOR: 'Industrietor',
  SCHRANKE: 'Schranke',
};

export const operationModeLabels: LabelMap<OperationMode> = {
  HANDBETAETIGT: 'Handbetätigt',
  KRAFTBETAETIGT: 'Kraftbetätigt',
};

export const doorStatusLabels: LabelMap<DoorStatus> = {
  IN_BETRIEB: 'In Betrieb',
  EINGESCHRAENKT: 'Eingeschränkt nutzbar',
  AUSSER_BETRIEB: 'Außer Betrieb',
  STILLGELEGT: 'Stillgelegt',
};

export const inspectionTypeLabels: LabelMap<InspectionType> = {
  ERSTPRUEFUNG: 'Erstprüfung',
  WIEDERKEHRENDE_PRUEFUNG: 'Wiederkehrende Prüfung',
  AUSSERORDENTLICHE_PRUEFUNG: 'Außerordentliche Prüfung',
  NACHPRUEFUNG: 'Nachprüfung',
};

export const inspectionResultLabels: LabelMap<InspectionResult> = {
  BESTANDEN: 'Bestanden',
  BESTANDEN_MIT_HINWEISEN: 'Bestanden mit Hinweisen',
  GERINGE_MAENGEL: 'Geringe Mängel',
  ERHEBLICHE_MAENGEL: 'Erhebliche Mängel',
  NICHT_BESTANDEN: 'Nicht bestanden',
};

export const checkResultLabels: LabelMap<CheckResult> = {
  OK: 'In Ordnung',
  MANGEL: 'Mangel',
  NICHT_ZUTREFFEND: 'Nicht zutreffend',
  NICHT_GEPRUEFT: 'Nicht geprüft',
};

export const defectSeverityLabels: LabelMap<DefectSeverity> = {
  HINWEIS: 'Hinweis',
  GERING: 'Geringer Mangel',
  ERHEBLICH: 'Erheblicher Mangel',
  GEFAHR_IM_VERZUG: 'Gefahr im Verzug',
};

export const defectStatusLabels: LabelMap<DefectStatus> = {
  OFFEN: 'Offen',
  IN_BEARBEITUNG: 'In Bearbeitung',
  BEHOBEN: 'Behoben',
  AKZEPTIERT: 'Akzeptiert',
};

export const maintenanceContractStatusLabels: LabelMap<MaintenanceContractStatus> = {
  AKTIV: 'Aktiv',
  PAUSIERT: 'Pausiert',
  GEKUENDIGT: 'Gekündigt',
  ABGELAUFEN: 'Abgelaufen',
};

export const stockMovementTypeLabels: LabelMap<StockMovementType> = {
  ZUGANG: 'Zugang',
  ABGANG: 'Abgang',
  KORREKTUR: 'Korrektur',
  INVENTUR: 'Inventur',
  UMLAGERUNG: 'Umlagerung',
  RETOURE: 'Retoure',
};

export const purchaseOrderStatusLabels: LabelMap<PurchaseOrderStatus> = {
  ENTWURF: 'Entwurf',
  BESTELLT: 'Bestellt',
  TEILGELIEFERT: 'Teilgeliefert',
  GELIEFERT: 'Geliefert',
  STORNIERT: 'Storniert',
};

export const appointmentTypeLabels: LabelMap<AppointmentType> = {
  MONTAGE: 'Montage',
  WARTUNG: 'Wartung',
  PRUEFUNG: 'Prüfung',
  REPARATUR: 'Reparatur',
  AUFMASS: 'Aufmaß',
  BERATUNG: 'Beratung',
  INTERN: 'Intern',
};

export const appointmentStatusLabels: LabelMap<AppointmentStatus> = {
  GEPLANT: 'Geplant',
  BESTAETIGT: 'Bestätigt',
  UNTERWEGS: 'Unterwegs',
  ERLEDIGT: 'Erledigt',
  ABGESAGT: 'Abgesagt',
};

export const projectStatusLabels: LabelMap<ProjectStatus> = {
  PLANUNG: 'Planung',
  LAUFEND: 'Laufend',
  PAUSIERT: 'Pausiert',
  ABGESCHLOSSEN: 'Abgeschlossen',
  ABGEBROCHEN: 'Abgebrochen',
};

export const timeEntryTypeLabels: LabelMap<TimeEntryType> = {
  ARBEITSZEIT: 'Arbeitszeit',
  FAHRTZEIT: 'Fahrtzeit',
  BEREITSCHAFT: 'Bereitschaft',
  URLAUB: 'Urlaub',
  KRANKHEIT: 'Krankheit',
  FEIERTAG: 'Feiertag',
  SCHULUNG: 'Schulung',
};

export const employmentTypeLabels: LabelMap<EmploymentType> = {
  VOLLZEIT: 'Vollzeit',
  TEILZEIT: 'Teilzeit',
  MINIJOB: 'Minijob',
  AUSZUBILDENDER: 'Auszubildende:r',
  AUSHILFE: 'Aushilfe',
  FREIER_MITARBEITER: 'Freie:r Mitarbeiter:in',
};

export const absenceTypeLabels: LabelMap<AbsenceType> = {
  URLAUB: 'Urlaub',
  KRANKHEIT: 'Krankheit',
  GLEITZEIT: 'Gleitzeit',
  SCHULUNG: 'Schulung',
  UNBEZAHLT: 'Unbezahlt',
  SONSTIGES: 'Sonstiges',
};

export const absenceStatusLabels: LabelMap<AbsenceStatus> = {
  BEANTRAGT: 'Beantragt',
  GENEHMIGT: 'Genehmigt',
  ABGELEHNT: 'Abgelehnt',
  STORNIERT: 'Storniert',
};

export const documentCategoryLabels: LabelMap<DocumentCategory> = {
  ANGEBOT: 'Angebot',
  AUFTRAG: 'Auftrag',
  RECHNUNG: 'Rechnung',
  MAHNUNG: 'Mahnung',
  PRUEFPROTOKOLL: 'Prüfprotokoll',
  SERVICEBERICHT: 'Servicebericht',
  WARTUNGSVERTRAG: 'Wartungsvertrag',
  FOTO: 'Foto',
  TECHNISCHE_UNTERLAGE: 'Technische Unterlage',
  PERSONAL: 'Personalunterlage',
  SONSTIGES: 'Sonstiges',
};
