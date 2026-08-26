-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'GESCHAEFTSFUEHRUNG', 'BUERO', 'BUCHHALTUNG', 'MONTEUR');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('VOLLZEIT', 'TEILZEIT', 'MINIJOB', 'AUSZUBILDENDER', 'AUSHILFE', 'FREIER_MITARBEITER');

-- CreateEnum
CREATE TYPE "AbsenceType" AS ENUM ('URLAUB', 'KRANKHEIT', 'GLEITZEIT', 'SCHULUNG', 'UNBEZAHLT', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "AbsenceStatus" AS ENUM ('BEANTRAGT', 'GENEHMIGT', 'ABGELEHNT', 'STORNIERT');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PRIVAT', 'GEWERBE', 'OEFFENTLICH', 'HAUSVERWALTUNG');

-- CreateEnum
CREATE TYPE "Salutation" AS ENUM ('HERR', 'FRAU', 'DIVERS', 'FIRMA');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('RECHNUNG', 'LIEFERUNG', 'OBJEKT');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('ENTWURF', 'VERSENDET', 'ANGENOMMEN', 'ABGELEHNT', 'ABGELAUFEN', 'STORNIERT');

-- CreateEnum
CREATE TYPE "LineItemType" AS ENUM ('ARTIKEL', 'LEISTUNG', 'TEXT', 'ZWISCHENSUMME');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('ANGELEGT', 'EINGEPLANT', 'IN_ARBEIT', 'WARTET_AUF_MATERIAL', 'ABGESCHLOSSEN', 'ABGERECHNET', 'STORNIERT');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MONTAGE', 'REPARATUR', 'WARTUNG', 'PRUEFUNG', 'NOTDIENST', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('RECHNUNG', 'ABSCHLAGSRECHNUNG', 'SCHLUSSRECHNUNG', 'GUTSCHRIFT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ENTWURF', 'OFFEN', 'TEILBEZAHLT', 'BEZAHLT', 'UEBERFAELLIG', 'STORNIERT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UEBERWEISUNG', 'BAR', 'KARTE', 'LASTSCHRIFT', 'PAYPAL', 'VERRECHNUNG');

-- CreateEnum
CREATE TYPE "DunningLevel" AS ENUM ('ZAHLUNGSERINNERUNG', 'MAHNUNG_1', 'MAHNUNG_2', 'LETZTE_MAHNUNG', 'INKASSO');

-- CreateEnum
CREATE TYPE "DunningStatus" AS ENUM ('ENTWURF', 'VERSENDET', 'ERLEDIGT', 'ABGEBROCHEN');

-- CreateEnum
CREATE TYPE "DoorType" AS ENUM ('SECTIONALTOR', 'SCHWINGTOR', 'ROLLTOR', 'ROLLGITTER', 'SCHIEBETOR', 'FALTTOR', 'FLUEGELTOR', 'SCHNELLLAUFTOR', 'FEUERSCHUTZABSCHLUSS', 'INDUSTRIETOR', 'SCHRANKE');

-- CreateEnum
CREATE TYPE "OperationMode" AS ENUM ('HANDBETAETIGT', 'KRAFTBETAETIGT');

-- CreateEnum
CREATE TYPE "DoorStatus" AS ENUM ('IN_BETRIEB', 'EINGESCHRAENKT', 'AUSSER_BETRIEB', 'STILLGELEGT');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('ERSTPRUEFUNG', 'WIEDERKEHRENDE_PRUEFUNG', 'AUSSERORDENTLICHE_PRUEFUNG', 'NACHPRUEFUNG');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('BESTANDEN', 'BESTANDEN_MIT_HINWEISEN', 'GERINGE_MAENGEL', 'ERHEBLICHE_MAENGEL', 'NICHT_BESTANDEN');

-- CreateEnum
CREATE TYPE "CheckResult" AS ENUM ('OK', 'MANGEL', 'NICHT_ZUTREFFEND', 'NICHT_GEPRUEFT');

-- CreateEnum
CREATE TYPE "DefectSeverity" AS ENUM ('HINWEIS', 'GERING', 'ERHEBLICH', 'GEFAHR_IM_VERZUG');

-- CreateEnum
CREATE TYPE "DefectStatus" AS ENUM ('OFFEN', 'IN_BEARBEITUNG', 'BEHOBEN', 'AKZEPTIERT');

-- CreateEnum
CREATE TYPE "ServiceReportStatus" AS ENUM ('ENTWURF', 'ABGESCHLOSSEN', 'ABGERECHNET');

-- CreateEnum
CREATE TYPE "MaintenanceContractStatus" AS ENUM ('AKTIV', 'PAUSIERT', 'GEKUENDIGT', 'ABGELAUFEN');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('ZUGANG', 'ABGANG', 'KORREKTUR', 'INVENTUR', 'UMLAGERUNG', 'RETOURE');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('ENTWURF', 'BESTELLT', 'TEILGELIEFERT', 'GELIEFERT', 'STORNIERT');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('MONTAGE', 'WARTUNG', 'PRUEFUNG', 'REPARATUR', 'AUFMASS', 'BERATUNG', 'INTERN');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('GEPLANT', 'BESTAETIGT', 'UNTERWEGS', 'ERLEDIGT', 'ABGESAGT');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANUNG', 'LAUFEND', 'PAUSIERT', 'ABGESCHLOSSEN', 'ABGEBROCHEN');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OFFEN', 'IN_ARBEIT', 'ERLEDIGT');

-- CreateEnum
CREATE TYPE "TimeEntryType" AS ENUM ('ARBEITSZEIT', 'FAHRTZEIT', 'BEREITSCHAFT', 'URLAUB', 'KRANKHEIT', 'FEIERTAG', 'SCHULUNG');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('ANGEBOT', 'AUFTRAG', 'RECHNUNG', 'MAHNUNG', 'PRUEFPROTOKOLL', 'SERVICEBERICHT', 'WARTUNGSVERTRAG', 'FOTO', 'TECHNISCHE_UNTERLAGE', 'PERSONAL', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('CUSTOMER', 'SITE', 'QUOTE', 'ORDER', 'INVOICE', 'DOOR', 'INSPECTION', 'SERVICE_REPORT', 'MAINTENANCE_CONTRACT', 'PROJECT', 'EMPLOYEE', 'ARTICLE', 'SUPPLIER', 'PURCHASE_ORDER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'BUERO',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "position" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'VOLLZEIT',
    "hireDate" TIMESTAMP(3) NOT NULL,
    "exitDate" TIMESTAMP(3),
    "weeklyHours" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "hourlyCost" DECIMAL(10,2),
    "hourlyRate" DECIMAL(10,2),
    "vacationDays" INTEGER NOT NULL DEFAULT 30,
    "street" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "birthDate" TIMESTAMP(3),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualifications" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "certificate" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "qualifiesForInspection" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "absences" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "AbsenceType" NOT NULL,
    "status" "AbsenceStatus" NOT NULL DEFAULT 'BEANTRAGT',
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "days" DECIMAL(5,2) NOT NULL,
    "reason" TEXT,
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "absences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "customerNumber" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'PRIVAT',
    "salutation" "Salutation",
    "companyName" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "website" TEXT,
    "vatId" TEXT,
    "taxNumber" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 14,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "reverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "creditLimit" DECIMAL(12,2),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "AddressType" NOT NULL DEFAULT 'RECHNUNG',
    "label" TEXT,
    "street" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'DE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salutation" "Salutation",
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'DE',
    "accessNotes" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'ENTWURF',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "introText" TEXT,
    "outroText" TEXT,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "netTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "LineItemType" NOT NULL DEFAULT 'LEISTUNG',
    "articleId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'Stk',
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 19,
    "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "optional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT,
    "quoteId" TEXT,
    "projectId" TEXT,
    "type" "OrderType" NOT NULL DEFAULT 'MONTAGE',
    "status" "OrderStatus" NOT NULL DEFAULT 'ANGELEGT',
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "customerReference" TEXT,
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "netTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "LineItemType" NOT NULL DEFAULT 'LEISTUNG',
    "articleId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'Stk',
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 19,
    "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "invoicedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL DEFAULT 'RECHNUNG',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ENTWURF',
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "serviceDate" TIMESTAMP(3),
    "subject" TEXT NOT NULL,
    "introText" TEXT,
    "outroText" TEXT,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "netTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "dunningLevel" "DunningLevel",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "LineItemType" NOT NULL DEFAULT 'LEISTUNG',
    "articleId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'Stk',
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 19,
    "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "PaymentMethod" NOT NULL DEFAULT 'UEBERWEISUNG',
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dunnings" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "level" "DunningLevel" NOT NULL,
    "status" "DunningStatus" NOT NULL DEFAULT 'ENTWURF',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "openAmount" DECIMAL(12,2) NOT NULL,
    "fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "interest" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "daysOverdue" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dunnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doors" (
    "id" TEXT NOT NULL,
    "doorNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT,
    "type" "DoorType" NOT NULL,
    "operationMode" "OperationMode" NOT NULL DEFAULT 'KRAFTBETAETIGT',
    "status" "DoorStatus" NOT NULL DEFAULT 'IN_BETRIEB',
    "location" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "yearBuilt" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "weightKg" DECIMAL(8,2),
    "driveManufacturer" TEXT,
    "driveModel" TEXT,
    "driveSerialNumber" TEXT,
    "installationDate" TIMESTAMP(3),
    "warrantyUntil" TIMESTAMP(3),
    "nextInspectionDue" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" TEXT NOT NULL,
    "inspectionNumber" TEXT NOT NULL,
    "doorId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "InspectionType" NOT NULL DEFAULT 'WIEDERKEHRENDE_PRUEFUNG',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectorId" TEXT,
    "inspectorName" TEXT NOT NULL,
    "result" "InspectionResult",
    "nextDueDate" TIMESTAMP(3),
    "summary" TEXT,
    "recommendation" TEXT,
    "signatureInspector" TEXT,
    "signatureCustomer" TEXT,
    "signedByName" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_checks" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "reference" TEXT,
    "result" "CheckResult" NOT NULL DEFAULT 'NICHT_GEPRUEFT',
    "measuredValue" DECIMAL(10,2),
    "unit" TEXT,
    "limitValue" DECIMAL(10,2),
    "comment" TEXT,

    CONSTRAINT "inspection_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defects" (
    "id" TEXT NOT NULL,
    "doorId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "severity" "DefectSeverity" NOT NULL DEFAULT 'GERING',
    "status" "DefectStatus" NOT NULL DEFAULT 'OFFEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "checkKey" TEXT,
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_reports" (
    "id" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "orderId" TEXT,
    "doorId" TEXT,
    "technicianId" TEXT,
    "status" "ServiceReportStatus" NOT NULL DEFAULT 'ENTWURF',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivalTime" TIMESTAMP(3),
    "departureTime" TIMESTAMP(3),
    "workHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "travelHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "travelKm" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "faultDescription" TEXT,
    "workPerformed" TEXT NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "signatureCustomer" TEXT,
    "signatureTechnician" TEXT,
    "signedByName" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_report_materials" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "articleId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'Stk',
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "service_report_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_contracts" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "MaintenanceContractStatus" NOT NULL DEFAULT 'AKTIV',
    "title" TEXT NOT NULL,
    "intervalMonths" INTEGER NOT NULL DEFAULT 12,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "noticePeriodMonths" INTEGER NOT NULL DEFAULT 3,
    "lastServiceDate" TIMESTAMP(3),
    "nextServiceDate" TIMESTAMP(3),
    "includesInspection" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "articleNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "manufacturer" TEXT,
    "manufacturerNumber" TEXT,
    "ean" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'Stk',
    "purchasePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "salesPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 19,
    "stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "storageLocation" TEXT,
    "supplierId" TEXT,
    "stockManaged" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "stockAfter" DECIMAL(12,3) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT,
    "purchaseOrderId" TEXT,
    "userId" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "supplierNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "street" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'DE',
    "customerNumber" TEXT,
    "vatId" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'ENTWURF',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "netTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "articleId" TEXT,
    "title" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "deliveredQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'Stk',
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 19,
    "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "AppointmentType" NOT NULL DEFAULT 'MONTAGE',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'GEPLANT',
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT,
    "siteId" TEXT,
    "orderId" TEXT,
    "location" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "projectNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT,
    "siteId" TEXT,
    "managerId" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANUNG',
    "description" TEXT,
    "budget" DECIMAL(12,2),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OFFEN',
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "milestone" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "TimeEntryType" NOT NULL DEFAULT 'ARBEITSZEIT',
    "date" TIMESTAMP(3) NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "hours" DECIMAL(6,2) NOT NULL,
    "orderId" TEXT,
    "projectId" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "invoiced" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'SONSTIGES',
    "entityType" "EntityType",
    "entityId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'allgemein',
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "number_ranges" (
    "entity" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "suffix" TEXT NOT NULL DEFAULT '',
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 4,
    "yearlyReset" BOOLEAN NOT NULL DEFAULT true,
    "currentYear" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "number_ranges_pkey" PRIMARY KEY ("entity")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MaintenanceContractDoors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MaintenanceContractDoors_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AppointmentAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AppointmentAssignees_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE INDEX "users_active_idx" ON "users"("active");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_revokedAt_idx" ON "refresh_tokens"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeNumber_key" ON "employees"("employeeNumber");

-- CreateIndex
CREATE INDEX "employees_active_lastName_idx" ON "employees"("active", "lastName");

-- CreateIndex
CREATE INDEX "qualifications_employeeId_idx" ON "qualifications"("employeeId");

-- CreateIndex
CREATE INDEX "qualifications_expiresAt_idx" ON "qualifications"("expiresAt");

-- CreateIndex
CREATE INDEX "absences_employeeId_from_idx" ON "absences"("employeeId", "from");

-- CreateIndex
CREATE INDEX "absences_status_idx" ON "absences"("status");

-- CreateIndex
CREATE UNIQUE INDEX "customers_customerNumber_key" ON "customers"("customerNumber");

-- CreateIndex
CREATE INDEX "customers_active_idx" ON "customers"("active");

-- CreateIndex
CREATE INDEX "customers_companyName_idx" ON "customers"("companyName");

-- CreateIndex
CREATE INDEX "customers_lastName_idx" ON "customers"("lastName");

-- CreateIndex
CREATE INDEX "addresses_customerId_type_idx" ON "addresses"("customerId", "type");

-- CreateIndex
CREATE INDEX "contacts_customerId_idx" ON "contacts"("customerId");

-- CreateIndex
CREATE INDEX "sites_customerId_idx" ON "sites"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_quoteNumber_key" ON "quotes"("quoteNumber");

-- CreateIndex
CREATE INDEX "quotes_customerId_idx" ON "quotes"("customerId");

-- CreateIndex
CREATE INDEX "quotes_status_date_idx" ON "quotes"("status", "date");

-- CreateIndex
CREATE INDEX "quote_items_articleId_idx" ON "quote_items"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_items_quoteId_position_key" ON "quote_items"("quoteId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- CreateIndex
CREATE INDEX "orders_status_plannedStart_idx" ON "orders"("status", "plannedStart");

-- CreateIndex
CREATE INDEX "orders_projectId_idx" ON "orders"("projectId");

-- CreateIndex
CREATE INDEX "order_items_articleId_idx" ON "order_items"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_orderId_position_key" ON "order_items"("orderId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_customerId_idx" ON "invoices"("customerId");

-- CreateIndex
CREATE INDEX "invoices_status_dueDate_idx" ON "invoices"("status", "dueDate");

-- CreateIndex
CREATE INDEX "invoices_date_idx" ON "invoices"("date");

-- CreateIndex
CREATE INDEX "invoice_items_articleId_idx" ON "invoice_items"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_items_invoiceId_position_key" ON "invoice_items"("invoiceId", "position");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_date_idx" ON "payments"("date");

-- CreateIndex
CREATE INDEX "dunnings_status_date_idx" ON "dunnings"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "dunnings_invoiceId_level_key" ON "dunnings"("invoiceId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "doors_doorNumber_key" ON "doors"("doorNumber");

-- CreateIndex
CREATE INDEX "doors_customerId_idx" ON "doors"("customerId");

-- CreateIndex
CREATE INDEX "doors_siteId_idx" ON "doors"("siteId");

-- CreateIndex
CREATE INDEX "doors_nextInspectionDue_idx" ON "doors"("nextInspectionDue");

-- CreateIndex
CREATE UNIQUE INDEX "inspections_inspectionNumber_key" ON "inspections"("inspectionNumber");

-- CreateIndex
CREATE INDEX "inspections_doorId_date_idx" ON "inspections"("doorId", "date");

-- CreateIndex
CREATE INDEX "inspections_date_idx" ON "inspections"("date");

-- CreateIndex
CREATE INDEX "inspection_checks_inspectionId_idx" ON "inspection_checks"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_checks_inspectionId_position_key" ON "inspection_checks"("inspectionId", "position");

-- CreateIndex
CREATE INDEX "defects_doorId_status_idx" ON "defects"("doorId", "status");

-- CreateIndex
CREATE INDEX "defects_status_dueDate_idx" ON "defects"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "service_reports_reportNumber_key" ON "service_reports"("reportNumber");

-- CreateIndex
CREATE INDEX "service_reports_orderId_idx" ON "service_reports"("orderId");

-- CreateIndex
CREATE INDEX "service_reports_doorId_date_idx" ON "service_reports"("doorId", "date");

-- CreateIndex
CREATE INDEX "service_reports_technicianId_date_idx" ON "service_reports"("technicianId", "date");

-- CreateIndex
CREATE INDEX "service_report_materials_reportId_idx" ON "service_report_materials"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_contracts_contractNumber_key" ON "maintenance_contracts"("contractNumber");

-- CreateIndex
CREATE INDEX "maintenance_contracts_customerId_idx" ON "maintenance_contracts"("customerId");

-- CreateIndex
CREATE INDEX "maintenance_contracts_status_nextServiceDate_idx" ON "maintenance_contracts"("status", "nextServiceDate");

-- CreateIndex
CREATE UNIQUE INDEX "articles_articleNumber_key" ON "articles"("articleNumber");

-- CreateIndex
CREATE INDEX "articles_active_name_idx" ON "articles"("active", "name");

-- CreateIndex
CREATE INDEX "articles_category_idx" ON "articles"("category");

-- CreateIndex
CREATE INDEX "articles_supplierId_idx" ON "articles"("supplierId");

-- CreateIndex
CREATE INDEX "stock_movements_articleId_date_idx" ON "stock_movements"("articleId", "date");

-- CreateIndex
CREATE INDEX "stock_movements_orderId_idx" ON "stock_movements"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_supplierNumber_key" ON "suppliers"("supplierNumber");

-- CreateIndex
CREATE INDEX "suppliers_active_name_idx" ON "suppliers"("active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_orderNumber_key" ON "purchase_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");

-- CreateIndex
CREATE INDEX "purchase_orders_status_date_idx" ON "purchase_orders"("status", "date");

-- CreateIndex
CREATE INDEX "purchase_order_items_articleId_idx" ON "purchase_order_items"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_items_purchaseOrderId_position_key" ON "purchase_order_items"("purchaseOrderId", "position");

-- CreateIndex
CREATE INDEX "appointments_start_idx" ON "appointments"("start");

-- CreateIndex
CREATE INDEX "appointments_customerId_idx" ON "appointments"("customerId");

-- CreateIndex
CREATE INDEX "appointments_orderId_idx" ON "appointments"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_projectNumber_key" ON "projects"("projectNumber");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_customerId_idx" ON "projects"("customerId");

-- CreateIndex
CREATE INDEX "project_tasks_projectId_status_idx" ON "project_tasks"("projectId", "status");

-- CreateIndex
CREATE INDEX "time_entries_employeeId_date_idx" ON "time_entries"("employeeId", "date");

-- CreateIndex
CREATE INDEX "time_entries_orderId_idx" ON "time_entries"("orderId");

-- CreateIndex
CREATE INDEX "time_entries_projectId_idx" ON "time_entries"("projectId");

-- CreateIndex
CREATE INDEX "documents_entityType_entityId_idx" ON "documents"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "documents_category_idx" ON "documents"("category");

-- CreateIndex
CREATE INDEX "settings_category_idx" ON "settings"("category");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "_MaintenanceContractDoors_B_index" ON "_MaintenanceContractDoors"("B");

-- CreateIndex
CREATE INDEX "_AppointmentAssignees_B_index" ON "_AppointmentAssignees"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dunnings" ADD CONSTRAINT "dunnings_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doors" ADD CONSTRAINT "doors_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doors" ADD CONSTRAINT "doors_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_doorId_fkey" FOREIGN KEY ("doorId") REFERENCES "doors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_checks" ADD CONSTRAINT "inspection_checks_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_doorId_fkey" FOREIGN KEY ("doorId") REFERENCES "doors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_reports" ADD CONSTRAINT "service_reports_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_reports" ADD CONSTRAINT "service_reports_doorId_fkey" FOREIGN KEY ("doorId") REFERENCES "doors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_reports" ADD CONSTRAINT "service_reports_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_report_materials" ADD CONSTRAINT "service_report_materials_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "service_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_report_materials" ADD CONSTRAINT "service_report_materials_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_contracts" ADD CONSTRAINT "maintenance_contracts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MaintenanceContractDoors" ADD CONSTRAINT "_MaintenanceContractDoors_A_fkey" FOREIGN KEY ("A") REFERENCES "doors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MaintenanceContractDoors" ADD CONSTRAINT "_MaintenanceContractDoors_B_fkey" FOREIGN KEY ("B") REFERENCES "maintenance_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AppointmentAssignees" ADD CONSTRAINT "_AppointmentAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AppointmentAssignees" ADD CONSTRAINT "_AppointmentAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
