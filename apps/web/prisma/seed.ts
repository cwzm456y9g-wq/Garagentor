/**
 * Demodaten für die Entwicklung: ein Fachbetrieb mit Benutzern, Kunden,
 * Toranlagen, Belegen und Stammdaten. Der Lauf ist idempotent – vorhandene
 * Datensätze werden anhand ihrer fachlichen Schlüssel aktualisiert.
 */
import {
  addMonths,
  checkCatalogFor,
  DEFAULT_BASE_RATE,
  DEFAULT_MAINTENANCE_INTERVAL_MONTHS,
  INTEREST_POINTS,
  type OperationMode,
} from '@garagentor/shared';
import * as argon2 from 'argon2';
import { skriptClient } from './verbindung';

const prisma = skriptClient();

const DEMO_PASSWORD = 'Garagentor2026!';

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

function atTime(date: Date, hours: number, minutes = 0): Date {
  const stamp = new Date(date);
  stamp.setHours(hours, minutes, 0, 0);
  return stamp;
}

type CheckResult = 'OK' | 'MANGEL' | 'NICHT_ZUTREFFEND' | 'NICHT_GEPRUEFT';

type CheckOverride = {
  result?: CheckResult;
  measuredValue?: number;
  comment?: string;
};

/**
 * Baut die Prüfpunkte eines Protokolls aus dem Katalog auf – dieselbe Vorbelegung,
 * die auch die API beim Anlegen einer Prüfung vornimmt. Bei handbetätigten Anlagen
 * entfallen die Punkte zu Antrieb, Schutzeinrichtungen und Kraftmessung.
 */
function buildChecks(
  operationMode: OperationMode,
  overrides: Record<string, CheckOverride | undefined> = {},
  fallback: CheckResult = 'OK',
) {
  return checkCatalogFor(operationMode).map((definition, index) => {
    const override = overrides[definition.key] ?? {};
    return {
      position: index + 1,
      key: definition.key,
      group: definition.group,
      label: definition.label,
      reference: definition.reference ?? null,
      result: override.result ?? fallback,
      measuredValue: override.measuredValue ?? null,
      unit: definition.measurement?.unit ?? null,
      limitValue: definition.measurement?.limit ?? null,
      comment: override.comment ?? null,
    };
  });
}

async function seedSettings(): Promise<void> {
  const settings = [
    {
      key: 'firma',
      category: 'stammdaten',
      description: 'Firmendaten für Belegköpfe und Fußzeilen',
      value: {
        name: 'Tortechnik Weber GmbH',
        street: 'Industriestraße 14',
        zip: '48155',
        city: 'Münster',
        country: 'DE',
        phone: '0251 998877-0',
        email: 'info@tortechnik-weber.example',
        website: 'www.tortechnik-weber.example',
        vatId: 'DE812345678',
        taxNumber: '336/5711/0815',
        managingDirector: 'Katrin Weber',
        registerCourt: 'Amtsgericht Münster',
        registerNumber: 'HRB 12345',
        bankName: 'Sparkasse Münsterland Ost',
        iban: 'DE02 4005 0150 0000 1234 56',
        bic: 'WELADED1MST',
      },
    },
    {
      key: 'belege',
      category: 'belege',
      description: 'Vorgaben für Angebote und Rechnungen',
      value: {
        // Umsatzsteuer wird ausgewiesen. Wer unter § 19 UStG fällt, setzt den
        // Schalter in den Einstellungen; die Steuerlogik bleibt dabei erhalten,
        // damit sie beim Reißen der Umsatzgrenze sofort wieder greift.
        kleinunternehmer: false,
        defaultVatRate: 19,
        defaultPaymentTermsDays: 14,
        // Zwei Prozent binnen zehn Tagen ist im Handwerk üblich; die Toleranz
        // fängt das Runden des Kunden beim Überweisen ab.
        skontoPercent: 2,
        skontoDays: 10,
        skontoToleranz: 0.05,
        quoteValidityDays: 30,
        quoteIntroText:
          'vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:',
        quoteOutroText:
          'Die Preise verstehen sich zzgl. der gesetzlichen Umsatzsteuer. ' +
          'Wir freuen uns auf Ihren Auftrag.',
        invoiceOutroText:
          'Bitte überweisen Sie den Rechnungsbetrag ohne Abzug innerhalb der Zahlungsfrist ' +
          'unter Angabe der Rechnungsnummer.',
      },
    },
    {
      key: 'mahnwesen',
      category: 'mahnwesen',
      description: 'Fristen, Gebühren und Verzugszinsen des Mahnlaufs',
      value: {
        // Der Basiszinssatz nach § 247 BGB wird zum 1. Januar und 1. Juli neu
        // bekanntgegeben und muss gepflegt werden; die Anwendung weist darauf
        // hin, sobald ein Termin verstrichen ist.
        basiszinssatz: DEFAULT_BASE_RATE.percent,
        basiszinssatzGueltigAb: DEFAULT_BASE_RATE.validFrom,
        // Aufschlag nach § 288 BGB: fünf Punkte bei Verbrauchern, neun bei
        // Entgeltforderungen ohne Verbraucherbeteiligung.
        zinspunkteVerbraucher: INTEREST_POINTS.VERBRAUCHER,
        zinspunkteUnternehmen: INTEREST_POINTS.UNTERNEHMEN,
        stufen: [
          { level: 'ZAHLUNGSERINNERUNG', daysOverdue: 3, fee: 0, zinsen: false, graceDays: 7 },
          { level: 'MAHNUNG_1', daysOverdue: 14, fee: 5, zinsen: true, graceDays: 7 },
          { level: 'MAHNUNG_2', daysOverdue: 28, fee: 10, zinsen: true, graceDays: 7 },
          { level: 'LETZTE_MAHNUNG', daysOverdue: 42, fee: 15, zinsen: true, graceDays: 5 },
        ],
      },
    },
    {
      key: 'pruefung',
      category: 'branche',
      description: 'Vorgaben für die wiederkehrende Prüfung nach ASR A1.7',
      value: { intervalMonths: 12, reminderDaysBefore: 30, requireQualifiedInspector: true },
    },
    {
      key: 'mail',
      category: 'kommunikation',
      description: 'Absender, Signatur und Anschreiben für den Belegversand',
      value: {
        absender: 'Tortechnik Weber GmbH',
        antwortAn: '',
        // Ohne eigene Signatur wird sie aus den Firmendaten gebildet; hier
        // steht sie beispielhaft ausgeschrieben.
        signatur:
          'Tortechnik Weber GmbH\nIndustriestraße 14\n48155 Münster\n' +
          'Telefon 0251 998877-0\ninfo@tortechnik-weber.example',
        // Leere Vorlagen bedeuten: es gilt die Vorgabe aus dem Programm.
        vorlagen: {},
      },
    },
    {
      key: 'datev',
      category: 'buchhaltung',
      description: 'Vorgaben für den Buchungsstapel an die Kanzlei',
      value: {
        kontenrahmen: 'SKR03',
        // Berater- und Mandantennummer kommen vom Steuerberater; ohne sie
        // ordnet DATEV den Stapel keinem Mandanten zu.
        beraternummer: 0,
        mandantennummer: 0,
        sachkontenlaenge: 4,
        debitorBasis: 10000,
        festschreibung: false,
        erloeskonten: { 19: 8400, 7: 8300, 0: 8200 },
      },
    },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {
        value: setting.value,
        category: setting.category,
        description: setting.description,
      },
      create: setting,
    });
  }
}

async function main(): Promise<void> {
  console.log('Demodaten werden eingespielt …');

  await seedSettings();

  /* Mitarbeiter und Benutzer ------------------------------------------- */

  const employees = await Promise.all(
    [
      {
        employeeNumber: 'MA-001',
        firstName: 'Katrin',
        lastName: 'Weber',
        position: 'Geschäftsführung',
        hireDate: new Date('2009-04-01'),
        hourlyRate: 89,
        hourlyCost: 52,
      },
      {
        employeeNumber: 'MA-002',
        firstName: 'Jens',
        lastName: 'Brinkmann',
        position: 'Servicetechniker / Sachkundiger',
        hireDate: new Date('2014-08-01'),
        hourlyRate: 79,
        hourlyCost: 38,
      },
      {
        employeeNumber: 'MA-003',
        firstName: 'Melanie',
        lastName: 'Kohl',
        position: 'Auftragsabwicklung',
        hireDate: new Date('2019-02-15'),
        hourlyRate: 65,
        hourlyCost: 32,
      },
      {
        employeeNumber: 'MA-004',
        firstName: 'Tobias',
        lastName: 'Sander',
        position: 'Monteur',
        hireDate: new Date('2022-09-01'),
        hourlyRate: 72,
        hourlyCost: 34,
      },
    ].map((data) =>
      prisma.employee.upsert({
        where: { employeeNumber: data.employeeNumber },
        update: data,
        create: data,
      }),
    ),
  );

  const [weber, brinkmann, kohl, sander] = employees;

  // Sachkunde nach DGUV Information 208-022 berechtigt zur Prüfung nach ASR A1.7.
  // Die Nachweise werden relativ zum heutigen Tag datiert, damit der Demobetrieb
  // unabhängig vom Zeitpunkt des Seed-Laufs eine gültige Sachkunde vorweist.
  const brinkmannIssued = addMonths(new Date(), -10);
  const sanderIssued = addMonths(new Date(), -26);

  const qualifications = [
    {
      employeeId: brinkmann.id,
      name: 'Sachkundiger für kraftbetätigte Tore und Türen',
      issuer: 'TÜV NORD Akademie',
      certificate: 'SK-4471',
      issuedAt: brinkmannIssued,
      expiresAt: addMonths(brinkmannIssued, 36),
      qualifiesForInspection: true,
    },
    {
      employeeId: brinkmann.id,
      name: 'Elektrofachkraft für festgelegte Tätigkeiten',
      issuer: 'Handwerkskammer Münster',
      issuedAt: new Date('2016-11-02'),
      qualifiesForInspection: false,
    },
    {
      employeeId: sander.id,
      // Läuft in zehn Monaten ab und taucht damit in der Fristenübersicht auf.
      name: 'Sachkundiger für kraftbetätigte Tore und Türen',
      issuer: 'TÜV NORD Akademie',
      certificate: 'SK-1180',
      issuedAt: sanderIssued,
      expiresAt: addMonths(sanderIssued, 36),
      qualifiesForInspection: true,
    },
  ];

  for (const qualification of qualifications) {
    const existing = await prisma.qualification.findFirst({
      where: { employeeId: qualification.employeeId, name: qualification.name },
    });
    if (existing) {
      await prisma.qualification.update({ where: { id: existing.id }, data: qualification });
    } else {
      await prisma.qualification.create({ data: qualification });
    }
  }

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  const users = [
    {
      email: 'admin@tortechnik-weber.example',
      firstName: 'Katrin',
      lastName: 'Weber',
      role: 'ADMIN' as const,
      employeeId: weber.id,
    },
    {
      email: 'buero@tortechnik-weber.example',
      firstName: 'Melanie',
      lastName: 'Kohl',
      role: 'BUERO' as const,
      employeeId: kohl.id,
    },
    {
      email: 'monteur@tortechnik-weber.example',
      firstName: 'Jens',
      lastName: 'Brinkmann',
      role: 'MONTEUR' as const,
      employeeId: brinkmann.id,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { firstName: user.firstName, lastName: user.lastName, role: user.role },
      create: { ...user, passwordHash },
    });
  }

  /* Lieferanten und Artikel -------------------------------------------- */

  const supplier = await prisma.supplier.upsert({
    where: { supplierNumber: 'L-0001' },
    update: {},
    create: {
      supplierNumber: 'L-0001',
      name: 'Torbau Nord Großhandel GmbH',
      contactName: 'Herr Ostermann',
      email: 'vertrieb@torbau-nord.example',
      phone: '04101 55512-0',
      street: 'Hafenweg 8',
      zip: '25451',
      city: 'Quickborn',
      customerNumber: '44210',
      paymentTermsDays: 30,
      discountPercent: 3,
    },
  });

  const articles = [
    {
      articleNumber: 'A-00001',
      name: 'Sectionaltor 2500 × 2125 mm, weiß',
      category: 'Tore',
      manufacturer: 'Hörmann',
      unit: 'Stk',
      purchasePrice: 890,
      salesPrice: 1490,
      stock: 4,
      minStock: 2,
      storageLocation: 'Halle A / Regal 1',
    },
    {
      articleNumber: 'A-00002',
      name: 'Garagentorantrieb Serie 4, 700 N',
      category: 'Antriebe',
      manufacturer: 'Sommer',
      unit: 'Stk',
      purchasePrice: 245,
      salesPrice: 429,
      stock: 7,
      minStock: 3,
      storageLocation: 'Halle A / Regal 3',
    },
    {
      articleNumber: 'A-00003',
      name: 'Torsionsfeder rechts, Ø 67 mm',
      category: 'Ersatzteile',
      manufacturer: 'Torbau Nord',
      unit: 'Stk',
      purchasePrice: 34.5,
      salesPrice: 79,
      stock: 12,
      minStock: 6,
      storageLocation: 'Halle B / Fach 12',
    },
    {
      articleNumber: 'A-00004',
      name: 'Lichtschranke Einweg, 24 V',
      category: 'Sicherheitstechnik',
      manufacturer: 'Sommer',
      unit: 'Satz',
      purchasePrice: 42,
      salesPrice: 98,
      stock: 3,
      minStock: 5,
      storageLocation: 'Halle B / Fach 4',
    },
    {
      articleNumber: 'A-00005',
      name: 'Sicherheitskontaktleiste 2,5 m',
      category: 'Sicherheitstechnik',
      manufacturer: 'Fraba',
      unit: 'Stk',
      purchasePrice: 118,
      salesPrice: 229,
      stock: 2,
      minStock: 4,
      storageLocation: 'Halle B / Fach 5',
    },
    {
      articleNumber: 'A-00006',
      name: 'Laufrolle mit Kugellager',
      category: 'Ersatzteile',
      manufacturer: 'Torbau Nord',
      unit: 'Stk',
      purchasePrice: 6.4,
      salesPrice: 16.9,
      stock: 48,
      minStock: 20,
      storageLocation: 'Halle B / Fach 2',
    },
    {
      articleNumber: 'A-00007',
      name: 'Monteurstunde Service',
      category: 'Leistungen',
      unit: 'Std',
      purchasePrice: 0,
      salesPrice: 79,
      stockManaged: false,
      stock: 0,
      minStock: 0,
    },
    {
      articleNumber: 'A-00008',
      name: 'Anfahrtspauschale Umkreis 30 km',
      category: 'Leistungen',
      unit: 'Pau',
      purchasePrice: 0,
      salesPrice: 45,
      stockManaged: false,
      stock: 0,
      minStock: 0,
    },
    {
      articleNumber: 'A-00009',
      name: 'Wiederkehrende Prüfung nach ASR A1.7',
      category: 'Leistungen',
      unit: 'Stk',
      purchasePrice: 0,
      salesPrice: 89,
      stockManaged: false,
      stock: 0,
      minStock: 0,
    },
  ];

  const createdArticles = await Promise.all(
    articles.map((article) =>
      prisma.article.upsert({
        where: { articleNumber: article.articleNumber },
        update: article,
        create: { ...article, supplierId: article.category === 'Leistungen' ? null : supplier.id },
      }),
    ),
  );

  const articleByNumber = new Map(
    createdArticles.map((article) => [article.articleNumber, article]),
  );

  /* Kunden, Objekte, Toranlagen ---------------------------------------- */

  const logistik = await prisma.customer.upsert({
    where: { customerNumber: 'K-00001' },
    update: {},
    create: {
      customerNumber: 'K-00001',
      type: 'GEWERBE',
      companyName: 'Rheinland Logistik GmbH',
      email: 'technik@rheinland-logistik.example',
      phone: '0251 447700',
      vatId: 'DE298877123',
      paymentTermsDays: 30,
      discountPercent: 5,
      addresses: {
        create: [
          {
            type: 'RECHNUNG',
            street: 'Gewerbering 22',
            zip: '48163',
            city: 'Münster',
            isDefault: true,
          },
        ],
      },
      contacts: {
        create: [
          {
            salutation: 'HERR',
            firstName: 'Andreas',
            lastName: 'Peters',
            position: 'Technischer Leiter',
            email: 'a.peters@rheinland-logistik.example',
            phone: '0251 447700-31',
            isPrimary: true,
          },
        ],
      },
      sites: {
        create: [
          {
            name: 'Logistikzentrum West',
            street: 'Gewerbering 22',
            zip: '48163',
            city: 'Münster',
            accessNotes: 'Anmeldung an der Pforte, Schlüssel Nr. 7 im Meisterbüro.',
            contactName: 'Andreas Peters',
            contactPhone: '0251 447700-31',
          },
        ],
      },
    },
    include: { sites: true },
  });

  const privat = await prisma.customer.upsert({
    where: { customerNumber: 'K-00002' },
    update: {},
    create: {
      customerNumber: 'K-00002',
      type: 'PRIVAT',
      salutation: 'FRAU',
      firstName: 'Sabine',
      lastName: 'Hoffmann',
      email: 's.hoffmann@example.com',
      phone: '02501 88112',
      mobile: '0171 2233445',
      paymentTermsDays: 14,
      addresses: {
        create: [
          {
            type: 'RECHNUNG',
            street: 'Lindenweg 5',
            zip: '48268',
            city: 'Greven',
            isDefault: true,
          },
        ],
      },
      sites: {
        create: [{ name: 'Einfamilienhaus', street: 'Lindenweg 5', zip: '48268', city: 'Greven' }],
      },
    },
    include: { sites: true },
  });

  const hausverwaltung = await prisma.customer.upsert({
    where: { customerNumber: 'K-00003' },
    update: {},
    create: {
      customerNumber: 'K-00003',
      type: 'HAUSVERWALTUNG',
      companyName: 'Domizil Hausverwaltung e. K.',
      email: 'technik@domizil-hv.example',
      phone: '0251 336622',
      paymentTermsDays: 21,
      addresses: {
        create: [
          {
            type: 'RECHNUNG',
            street: 'Bahnhofstraße 40',
            zip: '48143',
            city: 'Münster',
            isDefault: true,
          },
        ],
      },
      sites: {
        create: [
          {
            name: 'Tiefgarage Wohnpark Aasee',
            street: 'Am Aasee 12',
            zip: '48151',
            city: 'Münster',
            accessNotes: 'Zufahrt über Hofeinfahrt, Funkhandsender beim Hausmeister.',
          },
        ],
      },
    },
    include: { sites: true },
  });

  const doors = [
    {
      doorNumber: 'TOR-00001',
      customerId: logistik.id,
      siteId: logistik.sites[0]?.id,
      type: 'SCHNELLLAUFTOR' as const,
      operationMode: 'KRAFTBETAETIGT' as const,
      location: 'Halle 1, Warenausgang Tor 3',
      manufacturer: 'Efaflex',
      model: 'SST-L',
      serialNumber: 'EF-2019-88214',
      yearBuilt: 2019,
      widthMm: 4000,
      heightMm: 4500,
      driveManufacturer: 'Efaflex',
      driveModel: 'EFA-SST',
      installationDate: new Date('2019-06-11'),
      nextInspectionDue: daysFromNow(-12),
    },
    {
      doorNumber: 'TOR-00002',
      customerId: logistik.id,
      siteId: logistik.sites[0]?.id,
      type: 'INDUSTRIETOR' as const,
      operationMode: 'KRAFTBETAETIGT' as const,
      location: 'Halle 2, Rampe Nord',
      manufacturer: 'Hörmann',
      model: 'SPU F42',
      serialNumber: 'HO-2021-33907',
      yearBuilt: 2021,
      widthMm: 3500,
      heightMm: 4000,
      weightKg: 310,
      driveManufacturer: 'Hörmann',
      driveModel: 'WA 300 S4',
      installationDate: new Date('2021-03-22'),
      nextInspectionDue: daysFromNow(18),
    },
    {
      doorNumber: 'TOR-00003',
      customerId: privat.id,
      siteId: privat.sites[0]?.id,
      type: 'SECTIONALTOR' as const,
      operationMode: 'KRAFTBETAETIGT' as const,
      location: 'Garage, Hofseite',
      manufacturer: 'Hörmann',
      model: 'LPU 42',
      serialNumber: 'HO-2024-11255',
      yearBuilt: 2024,
      widthMm: 2500,
      heightMm: 2125,
      driveManufacturer: 'Sommer',
      driveModel: 'Base+ 800',
      installationDate: new Date('2024-05-08'),
      warrantyUntil: new Date('2029-05-08'),
      nextInspectionDue: daysFromNow(120),
    },
    {
      doorNumber: 'TOR-00004',
      customerId: hausverwaltung.id,
      siteId: hausverwaltung.sites[0]?.id,
      type: 'ROLLGITTER' as const,
      operationMode: 'KRAFTBETAETIGT' as const,
      location: 'Tiefgarageneinfahrt',
      manufacturer: 'Novoferm',
      model: 'NovoRoll',
      serialNumber: 'NF-2017-77410',
      yearBuilt: 2017,
      widthMm: 3000,
      heightMm: 2200,
      driveManufacturer: 'Novoferm',
      driveModel: 'NovoTec',
      installationDate: new Date('2017-09-30'),
      nextInspectionDue: daysFromNow(9),
    },
  ];

  for (const door of doors) {
    await prisma.door.upsert({
      where: { doorNumber: door.doorNumber },
      update: door,
      create: door,
    });
  }

  // TOR-00003 (Sectionaltor) wird unten nicht gebraucht – die Lücke ist Absicht.
  const [schnelllauftor, industrietor, , rollgitter] = await Promise.all(
    ['TOR-00001', 'TOR-00002', 'TOR-00003', 'TOR-00004'].map((doorNumber) =>
      prisma.door.findUniqueOrThrow({ where: { doorNumber } }),
    ),
  );

  /* Wartungsvertrag ----------------------------------------------------- */

  await prisma.maintenanceContract.upsert({
    where: { contractNumber: 'WV-2024-0001' },
    update: {},
    create: {
      contractNumber: 'WV-2024-0001',
      customerId: logistik.id,
      title: 'Wartung und Prüfung Toranlagen Logistikzentrum West',
      intervalMonths: DEFAULT_MAINTENANCE_INTERVAL_MONTHS,
      price: 780,
      startDate: new Date('2024-01-01'),
      includesInspection: true,
      lastServiceDate: daysFromNow(-350),
      nextServiceDate: daysFromNow(15),
      doors: { connect: [{ doorNumber: 'TOR-00001' }, { doorNumber: 'TOR-00002' }] },
    },
  });

  /* Prüfprotokolle nach ASR A1.7 ---------------------------------------- */

  const brinkmannName = `${brinkmann.firstName} ${brinkmann.lastName}`;
  const sanderName = `${sander.firstName} ${sander.lastName}`;

  // Die Prüftermine sind so datiert, dass der Folgetermin genau auf die
  // nextInspectionDue der jeweiligen Anlage fällt.
  const inspections = [
    {
      inspectionNumber: 'PR-2026-0001',
      doorId: industrietor.id,
      operationMode: industrietor.operationMode,
      type: 'WIEDERKEHRENDE_PRUEFUNG' as const,
      date: daysFromNow(-347),
      inspectorId: brinkmann.id,
      inspectorName: brinkmannName,
      result: 'BESTANDEN' as const,
      nextDueDate: daysFromNow(18),
      summary: 'Die Anlage wurde ohne Beanstandung geprüft.',
      recommendation:
        'Laufrollen und Federpaket beim nächsten Wartungseinsatz nachfetten; ' +
        'Torblatt zeigt beginnende Anfahrspuren an der Unterkante.',
      signedByName: 'Andreas Peters',
      completedAt: daysFromNow(-347),
      overrides: {
        MESS_KRAFT_DYNAMISCH: {
          measuredValue: 312,
          comment: 'Messung an der Hauptschließkante, 300 mm über Oberkante Fertigfußboden.',
        },
        MESS_KRAFT_REST: { measuredValue: 96 },
        MESS_KRAFT_DAUER: { measuredValue: 620 },
      },
    },
    {
      inspectionNumber: 'PR-2026-0002',
      doorId: schnelllauftor.id,
      operationMode: schnelllauftor.operationMode,
      type: 'WIEDERKEHRENDE_PRUEFUNG' as const,
      date: daysFromNow(-377),
      inspectorId: sander.id,
      inspectorName: sanderName,
      result: 'BESTANDEN_MIT_HINWEISEN' as const,
      nextDueDate: daysFromNow(-12),
      summary: 'Die Anlage wurde geprüft; einzelne Prüfpunkte waren nicht zutreffend.',
      recommendation: 'Prüftermin ist überschritten – Wiederholungsprüfung kurzfristig einplanen.',
      signedByName: 'Andreas Peters',
      completedAt: daysFromNow(-377),
      overrides: {
        // Das Spiraltor läuft direkt angetrieben, ohne Federausgleich und Seilzug.
        BAU_FEDERN: {
          result: 'NICHT_ZUTREFFEND' as const,
          comment: 'Kein Federausgleich verbaut.',
        },
        SICH_FEDERBRUCH: { result: 'NICHT_ZUTREFFEND' as const },
        SICH_SEILBRUCH: { result: 'NICHT_ZUTREFFEND' as const, comment: 'Bauart ohne Tragseile.' },
        MESS_KRAFT_DYNAMISCH: { measuredValue: 358 },
        MESS_KRAFT_REST: { measuredValue: 118 },
        MESS_KRAFT_DAUER: { measuredValue: 690 },
      },
    },
    {
      inspectionNumber: 'PR-2026-0003',
      doorId: rollgitter.id,
      operationMode: rollgitter.operationMode,
      type: 'WIEDERKEHRENDE_PRUEFUNG' as const,
      date: daysFromNow(-5),
      inspectorId: brinkmann.id,
      inspectorName: brinkmannName,
      result: 'NICHT_BESTANDEN' as const,
      // Bei sicherheitsrelevanter Beanstandung wird kurzfristig nachgeprüft
      // statt erst nach zwölf Monaten.
      nextDueDate: daysFromNow(9),
      summary:
        'Sicherheitsrelevante Beanstandung an 1 Prüfpunkt(en). ' +
        'Die Anlage ist bis zur Instandsetzung außer Betrieb zu nehmen.',
      recommendation:
        'Einweglichtschranke ersetzen (Artikel A-00004) und Nachprüfung vor ' +
        'Wiederinbetriebnahme durchführen.',
      signedByName: 'M. Terhorst, Hausmeister',
      completedAt: daysFromNow(-5),
      overrides: {
        SCHUTZ_LICHTSCHRANKE: {
          result: 'MANGEL' as const,
          comment: 'Prüfkörper wird nicht erkannt, Empfänger ohne Betriebsanzeige.',
        },
        MESS_KRAFT_DYNAMISCH: { measuredValue: 340 },
        MESS_KRAFT_REST: { measuredValue: 105 },
        MESS_KRAFT_DAUER: { measuredValue: 610 },
      },
    },
    {
      // Offenes Protokoll: die Nachprüfung nach der Instandsetzung.
      inspectionNumber: 'PR-2026-0004',
      doorId: rollgitter.id,
      operationMode: rollgitter.operationMode,
      type: 'NACHPRUEFUNG' as const,
      date: daysFromNow(0),
      inspectorId: brinkmann.id,
      inspectorName: brinkmannName,
      result: null,
      nextDueDate: null,
      summary: null,
      recommendation: null,
      signedByName: null,
      completedAt: null,
      fallback: 'NICHT_GEPRUEFT' as const,
      overrides: {},
    },
  ];

  for (const { operationMode, overrides, fallback, ...inspection } of inspections) {
    const checks = buildChecks(operationMode, overrides, fallback ?? 'OK');
    await prisma.inspection.upsert({
      where: { inspectionNumber: inspection.inspectionNumber },
      update: { ...inspection, checks: { deleteMany: {}, create: checks } },
      create: { ...inspection, checks: { create: checks } },
    });
  }

  const failedInspection = await prisma.inspection.findUniqueOrThrow({
    where: { inspectionNumber: 'PR-2026-0003' },
  });

  /* Mangel aus der nicht bestandenen Prüfung ----------------------------- */

  const defect = {
    doorId: rollgitter.id,
    inspectionId: failedInspection.id,
    // Beanstandete Schutzeinrichtungen erben den höchsten Schweregrad.
    severity: 'GEFAHR_IM_VERZUG' as const,
    status: 'OFFEN' as const,
    title: 'Lichtschranke außer Funktion',
    description:
      'Empfänger der Einweglichtschranke reagiert nicht, Tor schließt ohne Absicherung ' +
      'der Hauptschließkante. Anlage bis zur Instandsetzung außer Betrieb genommen.',
    checkKey: 'SCHUTZ_LICHTSCHRANKE',
    dueDate: daysFromNow(-5),
  };

  const existingDefect = await prisma.defect.findFirst({
    where: { doorId: rollgitter.id, checkKey: 'SCHUTZ_LICHTSCHRANKE' },
  });
  if (existingDefect) {
    await prisma.defect.update({ where: { id: existingDefect.id }, data: defect });
  } else {
    await prisma.defect.create({ data: defect });
  }

  // Eine nicht bestandene Prüfung nimmt die Anlage außer Betrieb.
  await prisma.door.update({
    where: { id: rollgitter.id },
    data: { status: 'AUSSER_BETRIEB' },
  });

  /* Serviceberichte ------------------------------------------------------ */

  const reports = [
    {
      reportNumber: 'SB-2026-0001',
      doorId: rollgitter.id,
      technicianId: brinkmann.id,
      status: 'ABGERECHNET' as const,
      date: daysFromNow(-46),
      arrivalTime: atTime(daysFromNow(-46), 8, 0),
      departureTime: atTime(daysFromNow(-46), 11, 45),
      workHours: 3,
      travelFlatRate: 45,
      travelKm: 45,
      faultDescription:
        'Rollgitter blockiert beim Öffnen auf halber Höhe, laute Laufgeräusche in der Führung.',
      workPerformed:
        'Sechs ausgeschlagene Laufrollen ersetzt, Führungsschienen gereinigt und gefettet, ' +
        'Endlagen neu eingestellt, Probelauf über zehn Zyklen durchgeführt.',
      followUpRequired: false,
      signedByName: 'M. Terhorst, Hausmeister',
      completedAt: atTime(daysFromNow(-46), 11, 45),
      materials: [
        {
          articleId: articleByNumber.get('A-00006')?.id ?? null,
          name: 'Laufrolle mit Kugellager',
          quantity: 6,
          unit: 'Stk',
          unitPrice: 16.9,
        },
      ],
    },
    {
      reportNumber: 'SB-2026-0002',
      doorId: industrietor.id,
      technicianId: brinkmann.id,
      status: 'ABGESCHLOSSEN' as const,
      date: daysFromNow(-347),
      arrivalTime: atTime(daysFromNow(-347), 7, 30),
      departureTime: atTime(daysFromNow(-347), 10, 0),
      workHours: 2.5,
      travelFlatRate: 35,
      travelKm: 18,
      faultDescription: null,
      workPerformed:
        'Wartung nach Herstellervorgabe im Rahmen des Wartungsvertrags: Laufwerk, ' +
        'Federpaket und Befestigungen geprüft und gefettet, Schutzeinrichtungen und ' +
        'Kraftbegrenzung geprüft, anschließend wiederkehrende Prüfung nach ASR A1.7.',
      followUpRequired: false,
      signedByName: 'Andreas Peters',
      completedAt: atTime(daysFromNow(-347), 10, 0),
      materials: [],
    },
    {
      reportNumber: 'SB-2026-0003',
      doorId: schnelllauftor.id,
      technicianId: sander.id,
      status: 'ENTWURF' as const,
      date: daysFromNow(-3),
      arrivalTime: atTime(daysFromNow(-3), 13, 15),
      departureTime: atTime(daysFromNow(-3), 15, 0),
      workHours: 1.5,
      travelFlatRate: 35,
      travelKm: 22,
      faultDescription:
        'Tor fährt nach Not-Aus nicht mehr selbsttätig in die obere Endlage, ' +
        'Steuerung meldet Fehler F.07.',
      workPerformed:
        'Fehlerspeicher der Steuerung ausgelesen und zurückgesetzt, Endschalter ' +
        'nachjustiert, Behelfsbetrieb im Totmannbetrieb hergestellt.',
      followUpRequired: true,
      followUpNote:
        'Absolutwertgeber defekt, Ersatzteil beim Hersteller bestellt. ' +
        'Zweiter Einsatz nach Wareneingang erforderlich.',
      signedByName: null,
      completedAt: null,
      materials: [],
    },
  ];

  for (const { materials, ...report } of reports) {
    await prisma.serviceReport.upsert({
      where: { reportNumber: report.reportNumber },
      update: { ...report, materials: { deleteMany: {}, create: materials } },
      create: { ...report, materials: { create: materials } },
    });
  }

  /* Termine -------------------------------------------------------------- */

  // Die Einsatzplanung greift die offenen Vorgänge auf: die Nachprüfung der
  // stillgelegten Anlage, die fällige Wartung aus dem Vertrag, den überzogenen
  // Prüftermin und den Folgeauftrag aus dem Servicebericht.
  const termine = [
    {
      title: 'Lichtschranke tauschen – Tiefgarage Wohnpark Aasee',
      type: 'REPARATUR' as const,
      status: 'BESTAETIGT' as const,
      start: atTime(daysFromNow(1), 8, 0),
      end: atTime(daysFromNow(1), 10, 0),
      customerId: hausverwaltung.id,
      siteId: hausverwaltung.sites[0]?.id,
      location: 'Tiefgarageneinfahrt',
      description:
        'Einweglichtschranke ersetzen (Artikel A-00004). Anlage ist seit der Prüfung ' +
        'außer Betrieb, Zufahrt bis dahin nur über die Hofeinfahrt.',
      assignees: [brinkmann.id],
    },
    {
      title: 'Nachprüfung nach Instandsetzung – TOR-00004',
      type: 'PRUEFUNG' as const,
      status: 'GEPLANT' as const,
      start: atTime(daysFromNow(0), 8, 0),
      end: atTime(daysFromNow(0), 9, 30),
      customerId: logistik.id,
      siteId: logistik.sites[0]?.id,
      location: 'Halle 2, Rampe Nord',
      description:
        'Sichtprüfung nach der Reparatur, danach Schließkraft nachmessen. Schlüssel im ' +
        'Pförtnerhaus abholen.',
      assignees: [brinkmann.id],
    },
    {
      title: 'Nachprüfung Rollgitter Tiefgarage',
      type: 'PRUEFUNG' as const,
      status: 'GEPLANT' as const,
      start: atTime(daysFromNow(1), 10, 0),
      end: atTime(daysFromNow(1), 11, 0),
      customerId: hausverwaltung.id,
      siteId: hausverwaltung.sites[0]?.id,
      location: 'Tiefgarageneinfahrt',
      description: 'Protokoll PR-2026-0004 abschließen und Anlage wieder freigeben.',
      assignees: [brinkmann.id],
    },
    {
      title: 'Prüftermin überzogen – Schnelllauftor Halle 1',
      type: 'PRUEFUNG' as const,
      status: 'GEPLANT' as const,
      start: atTime(daysFromNow(3), 7, 30),
      end: atTime(daysFromNow(3), 9, 30),
      customerId: logistik.id,
      siteId: logistik.sites[0]?.id,
      location: 'Halle 1, Warenausgang Tor 3',
      description: 'Wiederkehrende Prüfung nach ASR A1.7, Frist ist seit zwölf Tagen abgelaufen.',
      assignees: [sander.id],
    },
    {
      title: 'Steuerung instand setzen – Folgeauftrag SB-2026-0003',
      type: 'REPARATUR' as const,
      status: 'GEPLANT' as const,
      start: atTime(daysFromNow(6), 13, 0),
      end: atTime(daysFromNow(6), 15, 30),
      customerId: logistik.id,
      siteId: logistik.sites[0]?.id,
      location: 'Halle 1, Warenausgang Tor 3',
      description: 'Absolutwertgeber tauschen, sobald das Ersatzteil eingetroffen ist.',
      assignees: [sander.id],
    },
    {
      title: 'Aufmaß Garagentor – Familie Hoffmann',
      type: 'AUFMASS' as const,
      status: 'BESTAETIGT' as const,
      start: atTime(daysFromNow(8), 14, 0),
      end: atTime(daysFromNow(8), 15, 0),
      customerId: privat.id,
      siteId: privat.sites[0]?.id,
      location: 'Lindenweg 5, Greven',
      description: 'Maße für Angebot AN-2026-0001 bestätigen, Sturzhöhe prüfen.',
      assignees: [weber.id],
    },
    {
      title: 'Wartung Toranlagen Logistikzentrum West',
      type: 'WARTUNG' as const,
      status: 'GEPLANT' as const,
      start: atTime(daysFromNow(15), 7, 0),
      end: atTime(daysFromNow(15), 12, 0),
      customerId: logistik.id,
      siteId: logistik.sites[0]?.id,
      location: 'Halle 1 und 2',
      description:
        'Turnusmäßiger Einsatz aus Wartungsvertrag WV-2024-0001, einschließlich ' +
        'wiederkehrender Prüfung beider Anlagen.',
      assignees: [brinkmann.id, sander.id],
    },
    {
      title: 'Sicherheitsunterweisung und Werkstatttag',
      type: 'INTERN' as const,
      status: 'BESTAETIGT' as const,
      start: atTime(daysFromNow(17), 0, 0),
      end: atTime(daysFromNow(17), 23, 59),
      allDay: true,
      location: 'Betriebshof Münster',
      description: 'Jährliche Unterweisung, danach Fahrzeug- und Werkzeugkontrolle.',
      assignees: [weber.id, brinkmann.id, kohl.id, sander.id],
    },
    {
      title: 'Störungseinsatz Rollgitter – erledigt',
      type: 'REPARATUR' as const,
      status: 'ERLEDIGT' as const,
      start: atTime(daysFromNow(-46), 8, 0),
      end: atTime(daysFromNow(-46), 11, 45),
      customerId: hausverwaltung.id,
      siteId: hausverwaltung.sites[0]?.id,
      location: 'Tiefgarageneinfahrt',
      description: 'Dokumentiert in Servicebericht SB-2026-0001.',
      assignees: [brinkmann.id],
    },
  ];

  for (const { assignees, ...termin } of termine) {
    const zuweisung = assignees.map((id) => ({ id }));
    const vorhanden = await prisma.appointment.findFirst({ where: { title: termin.title } });
    if (vorhanden) {
      await prisma.appointment.update({
        where: { id: vorhanden.id },
        // set statt connect: entfernte Zuweisungen sollen beim erneuten Lauf
        // auch wieder verschwinden.
        data: { ...termin, assignees: { set: zuweisung } },
      });
    } else {
      await prisma.appointment.create({ data: { ...termin, assignees: { connect: zuweisung } } });
    }
  }

  /* Beleg: Angebot ------------------------------------------------------ */

  const tor = articleByNumber.get('A-00001');
  const antrieb = articleByNumber.get('A-00002');
  const stunde = articleByNumber.get('A-00007');
  const anfahrt = articleByNumber.get('A-00008');

  await prisma.quote.upsert({
    where: { quoteNumber: 'AN-2026-0001' },
    update: {},
    create: {
      quoteNumber: 'AN-2026-0001',
      customerId: privat.id,
      siteId: privat.sites[0]?.id,
      status: 'VERSENDET',
      date: daysFromNow(-6),
      validUntil: daysFromNow(24),
      subject: 'Austausch Garagentor inkl. Antrieb',
      introText: 'vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:',
      sentAt: daysFromNow(-6),
      // 1490,00 + 429,00 + 197,50 + 45,00 netto.
      netTotal: 2161.5,
      vatTotal: 410.69,
      grossTotal: 2572.19,
      items: {
        create: [
          {
            position: 1,
            type: 'ARTIKEL',
            articleId: tor?.id,
            title: 'Sectionaltor 2500 × 2125 mm, weiß',
            description: 'Hörmann LPU 42, Motiv Woodgrain, inkl. Zarge und Dichtungen',
            quantity: 1,
            unit: 'Stk',
            unitPrice: 1490,
            vatRate: 19,
            netAmount: 1490,
          },
          {
            position: 2,
            type: 'ARTIKEL',
            articleId: antrieb?.id,
            title: 'Garagentorantrieb Serie 4, 700 N',
            description: 'inkl. zwei Handsendern und Innentaster',
            quantity: 1,
            unit: 'Stk',
            unitPrice: 429,
            vatRate: 19,
            netAmount: 429,
          },
          {
            position: 3,
            type: 'LEISTUNG',
            articleId: stunde?.id,
            title: 'Montage und Demontage Altanlage',
            quantity: 2.5,
            unit: 'Std',
            unitPrice: 79,
            vatRate: 19,
            netAmount: 197.5,
          },
          {
            position: 4,
            type: 'LEISTUNG',
            articleId: anfahrt?.id,
            title: 'Anfahrtspauschale',
            quantity: 1,
            unit: 'Pau',
            unitPrice: 45,
            vatRate: 19,
            netAmount: 45,
          },
          {
            position: 5,
            type: 'TEXT',
            title: 'Hinweis',
            description:
              'Die Entsorgung der Altanlage ist im Preis enthalten. Die Einweisung nach ' +
              'ASR A1.7 erfolgt bei der Übergabe.',
            quantity: 0,
            unitPrice: 0,
            vatRate: 0,
            netAmount: 0,
          },
        ],
      },
    },
  });

  /* Beleg: überfällige Rechnung für den Mahnlauf ------------------------ */

  await prisma.invoice.upsert({
    where: { invoiceNumber: 'RE-2026-0001' },
    update: {},
    create: {
      invoiceNumber: 'RE-2026-0001',
      type: 'RECHNUNG',
      status: 'OFFEN',
      customerId: hausverwaltung.id,
      date: daysFromNow(-45),
      dueDate: daysFromNow(-24),
      serviceDate: daysFromNow(-46),
      subject: 'Reparatur Rollgitter Tiefgarage Wohnpark Aasee',
      // 237,00 + 101,40 + 45,00 netto; die Summen ergeben sich aus den
      // Positionen und dürfen nicht von Hand danebenliegen.
      netTotal: 383.4,
      vatTotal: 72.85,
      grossTotal: 456.25,
      items: {
        create: [
          {
            position: 1,
            type: 'LEISTUNG',
            articleId: stunde?.id,
            title: 'Servicestunden Störungsbeseitigung',
            quantity: 3,
            unit: 'Std',
            unitPrice: 79,
            vatRate: 19,
            netAmount: 237,
          },
          {
            position: 2,
            type: 'ARTIKEL',
            articleId: articleByNumber.get('A-00006')?.id,
            title: 'Laufrolle mit Kugellager',
            quantity: 6,
            unit: 'Stk',
            unitPrice: 16.9,
            vatRate: 19,
            netAmount: 101.4,
          },
          {
            position: 3,
            type: 'LEISTUNG',
            articleId: anfahrt?.id,
            title: 'Anfahrtspauschale',
            quantity: 1,
            unit: 'Pau',
            unitPrice: 45,
            vatRate: 19,
            netAmount: 45,
          },
        ],
      },
    },
  });

  /* Nummernkreise auf die vergebenen Nummern setzen --------------------- */

  const year = new Date().getFullYear();
  const ranges = [
    { entity: 'CUSTOMER', prefix: 'K-', padding: 5, yearlyReset: false, nextNumber: 4 },
    { entity: 'QUOTE', prefix: 'AN-', padding: 4, yearlyReset: true, nextNumber: 2 },
    { entity: 'INVOICE', prefix: 'RE-', padding: 4, yearlyReset: true, nextNumber: 2 },
    { entity: 'SERVICE_REPORT', prefix: 'SB-', padding: 4, yearlyReset: true, nextNumber: 4 },
    { entity: 'INSPECTION', prefix: 'PR-', padding: 4, yearlyReset: true, nextNumber: 5 },
    { entity: 'ARTICLE', prefix: 'A-', padding: 5, yearlyReset: false, nextNumber: 10 },
    { entity: 'DOOR', prefix: 'TOR-', padding: 5, yearlyReset: false, nextNumber: 5 },
    { entity: 'EMPLOYEE', prefix: 'MA-', padding: 3, yearlyReset: false, nextNumber: 5 },
    { entity: 'SUPPLIER', prefix: 'L-', padding: 4, yearlyReset: false, nextNumber: 2 },
    {
      entity: 'MAINTENANCE_CONTRACT',
      prefix: 'WV-',
      padding: 4,
      yearlyReset: true,
      nextNumber: 2,
    },
  ];

  for (const range of ranges) {
    await prisma.numberRange.upsert({
      where: { entity: range.entity },
      update: {},
      create: { ...range, currentYear: year },
    });
  }

  console.log('Demodaten eingespielt.');
  console.log('');
  console.log('  Zugangsdaten (Passwort für alle Konten):');
  console.log(`    Passwort: ${DEMO_PASSWORD}`);
  for (const user of users) {
    console.log(`    ${user.role.padEnd(8)} ${user.email}`);
  }
}

main()
  .catch((error) => {
    console.error('Seed fehlgeschlagen:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
