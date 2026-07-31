/**
 * Demodaten für die Entwicklung: ein Fachbetrieb mit Benutzern, Kunden,
 * Toranlagen, Belegen und Stammdaten. Der Lauf ist idempotent – vorhandene
 * Datensätze werden anhand ihrer fachlichen Schlüssel aktualisiert.
 */
import { addMonths, DEFAULT_MAINTENANCE_INTERVAL_MONTHS } from '@garagentor/shared';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Garagentor2026!';

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
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
        defaultVatRate: 19,
        defaultPaymentTermsDays: 14,
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
        stufen: [
          { level: 'ZAHLUNGSERINNERUNG', daysOverdue: 3, fee: 0, interestPercent: 0, graceDays: 7 },
          { level: 'MAHNUNG_1', daysOverdue: 14, fee: 5, interestPercent: 9, graceDays: 7 },
          { level: 'MAHNUNG_2', daysOverdue: 28, fee: 10, interestPercent: 9, graceDays: 7 },
          { level: 'LETZTE_MAHNUNG', daysOverdue: 42, fee: 15, interestPercent: 9, graceDays: 5 },
        ],
      },
    },
    {
      key: 'pruefung',
      category: 'branche',
      description: 'Vorgaben für die wiederkehrende Prüfung nach ASR A1.7',
      value: { intervalMonths: 12, reminderDaysBefore: 30, requireQualifiedInspector: true },
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
  const qualifications = [
    {
      employeeId: brinkmann.id,
      name: 'Sachkundiger für kraftbetätigte Tore und Türen',
      issuer: 'TÜV NORD Akademie',
      certificate: 'SK-2023-4471',
      issuedAt: new Date('2023-03-14'),
      expiresAt: addMonths(new Date('2023-03-14'), 36),
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
      name: 'Sachkundiger für kraftbetätigte Tore und Türen',
      issuer: 'TÜV NORD Akademie',
      certificate: 'SK-2025-1180',
      issuedAt: new Date('2025-05-20'),
      expiresAt: addMonths(new Date('2025-05-20'), 36),
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

  const rollgitter = await prisma.door.findUniqueOrThrow({ where: { doorNumber: 'TOR-00004' } });

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

  /* Offener Mangel ------------------------------------------------------ */

  const existingDefect = await prisma.defect.findFirst({
    where: { doorId: rollgitter.id, checkKey: 'SCHUTZ_LICHTSCHRANKE' },
  });
  if (!existingDefect) {
    await prisma.defect.create({
      data: {
        doorId: rollgitter.id,
        severity: 'ERHEBLICH',
        status: 'OFFEN',
        title: 'Lichtschranke außer Funktion',
        description:
          'Empfänger der Einweglichtschranke reagiert nicht, Tor schließt ohne Absicherung ' +
          'der Hauptschließkante. Nutzung bis zur Instandsetzung nur mit Totmannsteuerung.',
        checkKey: 'SCHUTZ_LICHTSCHRANKE',
        dueDate: daysFromNow(7),
      },
    });
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
      netTotal: 2166,
      vatTotal: 411.54,
      grossTotal: 2577.54,
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
      netTotal: 396,
      vatTotal: 75.24,
      grossTotal: 471.24,
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
