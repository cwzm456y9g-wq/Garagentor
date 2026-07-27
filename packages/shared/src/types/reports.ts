import type { EntityType } from '../enums';

/** Kennzahlen für die Startseite. */
export interface DashboardSummary {
  umsatzLaufendesJahr: number;
  umsatzLaufenderMonat: number;
  offenePostenBetrag: number;
  offenePostenAnzahl: number;
  ueberfaelligBetrag: number;
  ueberfaelligAnzahl: number;
  offeneAngeboteAnzahl: number;
  offeneAngeboteBetrag: number;
  aktiveAuftraegeAnzahl: number;
  faelligePruefungenAnzahl: number;
  ueberfaelligePruefungenAnzahl: number;
  offeneMaengelAnzahl: number;
  termineHeuteAnzahl: number;
  artikelUnterMindestbestand: number;
  lagerwert: number;
}

export interface RevenueBucket {
  /** ISO-Monat im Format YYYY-MM. */
  periode: string;
  netto: number;
  brutto: number;
  anzahl: number;
}

export interface TopCustomerRow {
  customerId: string;
  name: string;
  umsatz: number;
  rechnungen: number;
}

export interface OpenItemRow {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  date: string;
  dueDate: string;
  grossTotal: number;
  paidAmount: number;
  openAmount: number;
  daysOverdue: number;
  dunningLevel: string | null;
}

export interface InspectionDueRow {
  doorId: string;
  doorNumber: string;
  customerId: string;
  customerName: string;
  siteLabel: string | null;
  lastInspection: string | null;
  nextDueDate: string | null;
  daysUntilDue: number | null;
  overdue: boolean;
}

export interface EmployeeHoursRow {
  employeeId: string;
  name: string;
  stunden: number;
  abrechenbareStunden: number;
  fahrtzeitStunden: number;
}

export interface ArticleStockRow {
  articleId: string;
  articleNumber: string;
  name: string;
  stock: number;
  minStock: number;
  fehlmenge: number;
  wert: number;
}

/** Treffer der globalen Suche. */
export interface SearchHit {
  type: EntityType;
  id: string;
  title: string;
  subtitle?: string;
  /** Relativer Pfad im Web-Frontend. */
  href: string;
}

export interface SearchResponse {
  query: string;
  total: number;
  hits: SearchHit[];
}
