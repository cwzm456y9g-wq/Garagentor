/**
 * Antwortformen der API, soweit sie im Frontend gebraucht werden. Beträge
 * kommen dank des Decimal-Interceptors der API bereits als Zahl an.
 */
import type {
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
  DunningStatus,
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
  Role,
  Salutation,
  StockMovementType,
  TaskStatus,
  TimeEntryType,
} from '@garagentor/shared';

export interface CustomerRef {
  id: string;
  customerNumber?: string;
  companyName: string | null;
  firstName?: string | null;
  lastName: string | null;
}

export interface EmployeeRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Address {
  id: string;
  type: 'RECHNUNG' | 'LIEFERUNG' | 'OBJEKT';
  label: string | null;
  street: string;
  zip: string;
  city: string;
  country: string;
  isDefault: boolean;
}

export interface Contact {
  id: string;
  salutation: Salutation | null;
  firstName: string;
  lastName: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
}

export interface Site {
  id: string;
  name: string;
  street: string;
  zip: string;
  city: string;
  accessNotes: string | null;
  contactName: string | null;
  contactPhone: string | null;
  active: boolean;
}

export interface Customer {
  id: string;
  customerNumber: string;
  type: CustomerType;
  salutation: Salutation | null;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  vatId: string | null;
  paymentTermsDays: number;
  discountPercent: number;
  notes: string | null;
  active: boolean;
  addresses?: Address[];
  contacts?: Contact[];
  sites?: Site[];
  _count?: { doors: number; quotes?: number; orders: number; invoices: number };
}

export interface CustomerStatistics {
  umsatzNetto: number;
  umsatzBrutto: number;
  rechnungenAnzahl: number;
  offenePosten: number;
  offenePostenAnzahl: number;
  ueberfaellig: number;
  offeneAngebote: number;
  letzteRechnung: { invoiceNumber: string; date: string; grossTotal: number } | null;
}

export interface LineItem {
  id: string;
  position: number;
  type: LineItemType;
  articleId: string | null;
  title: string;
  description: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  vatRate: number;
  netAmount: number;
  optional?: boolean;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  status: 'ENTWURF' | 'VERSENDET' | 'ANGENOMMEN' | 'ABGELEHNT' | 'ABGELAUFEN' | 'STORNIERT';
  date: string;
  validUntil: string;
  subject: string;
  introText: string | null;
  outroText: string | null;
  discountPercent: number;
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
  rejectionReason: string | null;
  customerId: string;
  customer?: CustomerRef;
  site?: Site | null;
  items?: LineItem[];
  orders?: Array<{ id: string; orderNumber: string; status: OrderStatus }>;
  _count?: { items: number; orders: number };
}

export interface Order {
  id: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  subject: string;
  description: string | null;
  customerReference: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  completedAt: string | null;
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
  discountPercent: number;
  notes: string | null;
  customerId: string;
  customer?: CustomerRef;
  site?: Site | null;
  quote?: { id: string; quoteNumber: string } | null;
  project?: { id: string; projectNumber: string; name: string } | null;
  items?: LineItem[];
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    type: InvoiceType;
    status: InvoiceStatus;
    grossTotal: number;
    date: string;
  }>;
  appointments?: Appointment[];
  serviceReports?: Array<{ id: string; reportNumber: string; date: string; status: string }>;
  inspections?: Array<{ id: string; inspectionNumber: string; date: string; result: string }>;
  _count?: { invoices: number; appointments: number; serviceReports: number };
}

export interface OrderCosts {
  stunden: number;
  stundenNachArt: Array<{ typ: TimeEntryType; stunden: number }>;
  materialEinkauf: number;
  abgerechnetNetto: number;
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
}

export interface Dunning {
  id: string;
  level: DunningLevel;
  status: DunningStatus;
  date: string;
  dueDate: string;
  openAmount: number;
  fee: number;
  interest: number;
  /** Angewandter Verzugszinssatz; ergibt sich aus Basiszinssatz und Kundenart. */
  interestPercent: number;
  totalAmount: number;
  daysOverdue: number;
  sentAt: string | null;
  invoice?: {
    id: string;
    invoiceNumber: string;
    grossTotal: number;
    paidAmount: number;
    dueDate: string;
    customer: CustomerRef;
  };
}

export interface DunningPreview {
  invoiceId: string;
  invoiceNumber: string;
  customer: CustomerRef;
  level: DunningLevel;
  openAmount: number;
  fee: number;
  interest: number;
  interestPercent: number;
  totalAmount: number;
  daysOverdue: number;
  dueDate: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  date: string;
  dueDate: string;
  serviceDate: string | null;
  subject: string;
  introText: string | null;
  outroText: string | null;
  discountPercent: number;
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
  paidAmount: number;
  deductedAmount: number;
  payableAmount?: number;
  openAmount?: number;
  dunningLevel: DunningLevel | null;
  customerId: string;
  customer?: CustomerRef & { paymentTermsDays?: number };
  order?: { id: string; orderNumber: string; subject: string } | null;
  items?: LineItem[];
  payments?: Payment[];
  dunnings?: Dunning[];
  _count?: { payments: number; dunnings: number };
}

/* Branchenmodul -------------------------------------------------------- */

export interface Door {
  id: string;
  doorNumber: string;
  type: DoorType;
  operationMode: OperationMode;
  status: DoorStatus;
  location: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  yearBuilt: number | null;
  widthMm: number | null;
  heightMm: number | null;
  weightKg: number | null;
  driveManufacturer: string | null;
  driveModel: string | null;
  installationDate: string | null;
  warrantyUntil: string | null;
  nextInspectionDue: string | null;
  notes: string | null;
  customerId: string;
  customer?: CustomerRef;
  site?: Site | null;
  inspectionOverdue?: boolean;
  daysUntilInspection?: number | null;
  inspections?: InspectionSummary[];
  defects?: Defect[];
  serviceReports?: Array<{
    id: string;
    reportNumber: string;
    date: string;
    status: string;
    workPerformed: string;
  }>;
  contracts?: Array<{ id: string; contractNumber: string; title: string; status: string }>;
  _count?: { inspections: number; defects: number; serviceReports: number };
}

export interface InspectionSummary {
  id: string;
  inspectionNumber: string;
  date: string;
  type: InspectionType;
  result: InspectionResult | null;
  inspectorName: string;
  nextDueDate: string | null;
  completedAt: string | null;
}

export interface InspectionCheck {
  id: string;
  position: number;
  key: string;
  group: string;
  label: string;
  reference: string | null;
  result: CheckResult;
  measuredValue: number | null;
  unit: string | null;
  limitValue: number | null;
  comment: string | null;
}

export interface Inspection extends InspectionSummary {
  summary: string | null;
  recommendation: string | null;
  signedByName: string | null;
  doorId: string;
  door?: Door;
  inspector?: EmployeeRef | null;
  checks?: InspectionCheck[];
  defects?: Defect[];
  _count?: { defects: number };
}

export interface Defect {
  id: string;
  severity: DefectSeverity;
  status: DefectStatus;
  title: string;
  description: string | null;
  checkKey: string | null;
  dueDate: string | null;
  resolvedAt: string | null;
  resolvedNote: string | null;
  doorId: string;
  door?: { id: string; doorNumber: string; location: string; customer: CustomerRef };
  inspection?: { id: string; inspectionNumber: string; date: string } | null;
}

export interface ServiceReportMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  article?: { articleNumber: string; unit: string } | null;
}

export interface ServiceReport {
  id: string;
  reportNumber: string;
  status: 'ENTWURF' | 'ABGESCHLOSSEN' | 'ABGERECHNET';
  date: string;
  arrivalTime: string | null;
  departureTime: string | null;
  workHours: number;
  travelHours: number;
  travelKm: number;
  faultDescription: string | null;
  workPerformed: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  signedByName: string | null;
  completedAt: string | null;
  door?: Door | null;
  order?: { id: string; orderNumber: string; subject: string } | null;
  technician?: EmployeeRef | null;
  materials?: ServiceReportMaterial[];
  _count?: { materials: number };
}

export interface MaintenanceContract {
  id: string;
  contractNumber: string;
  status: MaintenanceContractStatus;
  title: string;
  intervalMonths: number;
  price: number;
  startDate: string;
  endDate: string | null;
  noticePeriodMonths: number;
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  includesInspection: boolean;
  notes: string | null;
  customerId: string;
  customer?: CustomerRef;
  doors?: Array<{ id: string; doorNumber: string; location: string; nextInspectionDue?: string }>;
}

/* Lager und Beschaffung ------------------------------------------------ */

export interface Article {
  id: string;
  articleNumber: string;
  name: string;
  description: string | null;
  category: string | null;
  manufacturer: string | null;
  manufacturerNumber: string | null;
  ean: string | null;
  unit: string;
  purchasePrice: number;
  salesPrice: number;
  vatRate: number;
  stock: number;
  minStock: number;
  storageLocation: string | null;
  stockManaged: boolean;
  active: boolean;
  margin?: number;
  belowMinStock?: boolean;
  supplier?: { id: string; name: string } | null;
  stockMovements?: StockMovement[];
}

export interface StockMovement {
  id: string;
  type: StockMovementType;
  quantity: number;
  stockAfter: number;
  date: string;
  reference: string | null;
  note: string | null;
  article?: { id: string; articleNumber: string; name: string; unit: string };
  order?: { id: string; orderNumber: string } | null;
  user?: EmployeeRef | null;
}

export interface Supplier {
  id: string;
  supplierNumber: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  customerNumber: string | null;
  paymentTermsDays: number;
  discountPercent: number;
  notes: string | null;
  active: boolean;
  articles?: Array<{
    id: string;
    articleNumber: string;
    name: string;
    stock: number;
    minStock: number;
  }>;
  purchaseOrders?: Array<{
    id: string;
    orderNumber: string;
    date: string;
    status: PurchaseOrderStatus;
    grossTotal: number;
  }>;
  _count?: { articles: number; purchaseOrders: number };
}

export interface PurchaseOrderItem {
  id: string;
  position: number;
  articleId: string | null;
  title: string;
  quantity: number;
  deliveredQuantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
  netAmount: number;
  article?: { id: string; articleNumber: string; stock: number } | null;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  date: string;
  expectedAt: string | null;
  deliveredAt: string | null;
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
  notes: string | null;
  supplierId: string;
  supplier?: { id: string; supplierNumber?: string; name: string };
  items?: PurchaseOrderItem[];
  stockMovements?: StockMovement[];
  _count?: { items: number };
}

export interface ReorderSuggestion {
  supplierId: string | null;
  supplierName: string;
  summe: number;
  positionen: Array<{
    articleId: string;
    articleNumber: string;
    name: string;
    unit: string;
    stock: number;
    minStock: number;
    vorschlagsmenge: number;
    einzelpreis: number;
    summe: number;
  }>;
}

/* Planung -------------------------------------------------------------- */

export interface Appointment {
  id: string;
  title: string;
  type: AppointmentType;
  status: AppointmentStatus;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  description: string | null;
  customer?: CustomerRef | null;
  site?: Pick<Site, 'id' | 'name' | 'street' | 'zip' | 'city'> | null;
  order?: { id: string; orderNumber: string; type?: OrderType } | null;
  assignees?: EmployeeRef[];
  conflicts?: Array<{ id: string; title: string; start: string; end: string }>;
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  milestone: boolean;
  position: number;
  completedAt: string | null;
  assignee?: EmployeeRef | null;
}

export interface Project {
  id: string;
  projectNumber: string;
  name: string;
  status: ProjectStatus;
  description: string | null;
  budget: number | null;
  startDate: string | null;
  endDate: string | null;
  fortschritt?: number;
  customer?: CustomerRef | null;
  site?: Site | null;
  manager?: EmployeeRef | null;
  orders?: Array<{
    id: string;
    orderNumber: string;
    subject: string;
    status: OrderStatus;
    netTotal: number;
    grossTotal: number;
  }>;
  tasks?: ProjectTask[];
  _count?: { orders: number; tasks: number };
}

export interface ProjectSummary {
  budget: number | null;
  auftragswert: number;
  auftraege: number;
  abgerechnetNetto: number;
  stunden: number;
  budgetAusgeschoepft: number | null;
}

export interface TimeEntry {
  id: string;
  type: TimeEntryType;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  hours: number;
  billable: boolean;
  invoiced: boolean;
  description: string | null;
  employeeId: string;
  employee?: EmployeeRef;
  order?: { id: string; orderNumber: string; subject?: string } | null;
  project?: { id: string; projectNumber: string; name: string } | null;
}

export interface WeekSummary {
  von: string;
  bis: string;
  summeStunden: number;
  abrechenbareStunden: number;
  tage: Array<{ datum: string; stunden: number; eintraege: TimeEntry[] }>;
}

/* Personal und Verwaltung ---------------------------------------------- */

export interface Qualification {
  id: string;
  name: string;
  issuer: string | null;
  certificate: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  qualifiesForInspection: boolean;
  notes: string | null;
  expired?: boolean;
  daysUntilExpiry?: number | null;
  employee?: { id: string; employeeNumber: string; firstName: string; lastName: string };
}

export interface VacationBalance {
  jahr: number;
  anspruch: number;
  genommen: number;
  beantragt: number;
  rest: number;
}

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  position: string | null;
  employmentType: EmploymentType;
  hireDate: string;
  exitDate: string | null;
  weeklyHours: number;
  hourlyCost: number | null;
  hourlyRate: number | null;
  vacationDays: number;
  active: boolean;
  user?: { id: string; email: string; role: Role; active?: boolean } | null;
  qualifications?: Qualification[];
  absences?: Absence[];
  urlaubskonto?: VacationBalance;
}

export interface Absence {
  id: string;
  type: AbsenceType;
  status: AbsenceStatus;
  from: string;
  to: string;
  days: number;
  reason: string | null;
  approvedAt: string | null;
  employeeId: string;
  employee?: EmployeeRef & { employeeNumber?: string };
  approver?: EmployeeRef | null;
}

export interface DocumentEntry {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  category: DocumentCategory;
  entityType: string | null;
  entityId: string | null;
  title: string | null;
  description: string | null;
  createdAt: string;
  uploadedBy?: EmployeeRef | null;
}

export interface NumberRange {
  entity: string;
  prefix: string;
  suffix: string;
  nextNumber: number;
  padding: number;
  yearlyReset: boolean;
  currentYear: number;
  konfiguriert: boolean;
}

export interface Setting {
  key: string;
  category: string;
  value: unknown;
  description: string | null;
}

/** Festgehaltener Stand einer Einstellungsgruppe. */
export interface SettingPreset {
  id: string;
  settingKey: string;
  name: string;
  favorite: boolean;
  value: unknown;
  createdAt: string;
  updatedAt: string;
}

/** Firmendaten für Belegköpfe und Fußzeilen. */
export interface CompanySettings {
  name?: string;
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  vatId?: string;
  taxNumber?: string;
  managingDirector?: string;
  registerCourt?: string;
  registerNumber?: string;
  bankName?: string;
  iban?: string;
  bic?: string;
  /** Logo als Data-URL, wird auf den Belegen eingebettet. */
  logo?: string;
}

/** Vorgaben für Angebote und Rechnungen. */
export interface DocumentSettings {
  defaultVatRate?: number;
  defaultPaymentTermsDays?: number;
  quoteValidityDays?: number;
  quoteIntroText?: string;
  quoteOutroText?: string;
  invoiceOutroText?: string;
}

export interface DunningLevelSetting {
  level: string;
  daysOverdue: number;
  fee: number;
  /** Ob auf dieser Stufe Verzugszinsen anfallen; die Höhe kommt aus dem Basiszinssatz. */
  zinsen: boolean;
  graceDays: number;
  /** Aus älteren Einstellungen; wird nur noch gelesen. */
  interestPercent?: number;
}

/** Mahnvorgaben samt Basiszinssatz. */
export interface DunningSettings {
  basiszinssatz?: number;
  basiszinssatzGueltigAb?: string;
  zinspunkteVerbraucher?: number;
  zinspunkteUnternehmen?: number;
  stufen?: DunningLevelSetting[];
}

export interface InspectionSettings {
  intervalMonths?: number;
  reminderDaysBefore?: number;
  requireQualifiedInspector?: boolean;
}

export interface OrderStatistics {
  nachStatus: Array<{ status: OrderStatus; anzahl: number; netto: number }>;
  nachArt: Array<{ art: OrderType; anzahl: number; netto: number }>;
}

export interface InspectionStatistics {
  jahr: number;
  ergebnisse: Array<{ ergebnis: InspectionResult; anzahl: number }>;
  faellig: number;
  ueberfaellig: number;
  offeneMaengel: Array<{ schweregrad: DefectSeverity; anzahl: number }>;
}

export interface ArticleStock {
  articleId: string;
  articleNumber: string;
  name: string;
  stock: number;
  minStock: number;
  fehlmenge: number;
  wert: number;
}
