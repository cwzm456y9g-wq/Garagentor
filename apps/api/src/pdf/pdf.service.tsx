import { Injectable, NotFoundException } from '@nestjs/common';
import { renderToBuffer } from '@react-pdf/renderer';
import { skontoAmount, skontoDeadline } from '@garagentor/shared';
import { EntityType } from '@prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { Angebot, anschrift, Rechnung, type BelegOptionen, type BelegPosition } from './belege';
import type { Firma } from './din5008';
import { renderGiroCode } from './girocode';
import { Mahnung } from './mahnung';
import { Pruefprotokoll } from './protokoll';
import { Servicebericht } from './servicebericht';

/** Ein Beleg als PDF samt Dateiname für den Download. */
export interface BelegDatei {
  buffer: Buffer;
  dateiname: string;
}

/** Prisma liefert Decimal; für die Anzeige wird gerechnet. */
type Dezimal = { toNumber(): number };

const zahl = (wert: Dezimal | number | null | undefined): number =>
  wert === null || wert === undefined ? 0 : typeof wert === 'number' ? wert : wert.toNumber();

@Injectable()
export class PdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  /* Einstellungen ------------------------------------------------------ */

  private async firma(): Promise<Firma> {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'firma' } });
    return (setting?.value as Firma | null) ?? {};
  }

  /** Ob ohne Umsatzsteuerausweis abgerechnet wird. */
  private async kleinunternehmer(): Promise<boolean> {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'belege' } });
    return (setting?.value as { kleinunternehmer?: boolean } | null)?.kleinunternehmer === true;
  }

  /* Positionen und Steueraufteilung ------------------------------------ */

  private positionen(
    items: Array<{
      position: number;
      type: string;
      title: string;
      description: string | null;
      quantity: Dezimal;
      unit: string | null;
      unitPrice: Dezimal;
      discountPercent: Dezimal;
      vatRate: Dezimal;
      netAmount: Dezimal;
      optional?: boolean;
    }>,
  ): BelegPosition[] {
    return items.map((item) => ({
      position: item.position,
      type: item.type,
      title: item.title,
      description: item.description,
      quantity: zahl(item.quantity),
      unit: item.unit,
      unitPrice: zahl(item.unitPrice),
      discountPercent: zahl(item.discountPercent),
      vatRate: zahl(item.vatRate),
      netAmount: zahl(item.netAmount),
      optional: item.optional === true,
    }));
  }

  /**
   * Steueraufteilung aus den Positionen. Optionale Positionen und Text- bzw.
   * Zwischensummenzeilen fließen nicht ein – wie in der Belegrechnung selbst.
   */
  private steuerzeilen(positionen: BelegPosition[]) {
    const nachSatz = new Map<number, number>();
    for (const pos of positionen) {
      if (pos.type === 'TEXT' || pos.type === 'ZWISCHENSUMME' || pos.optional) continue;
      nachSatz.set(pos.vatRate, (nachSatz.get(pos.vatRate) ?? 0) + pos.netAmount);
    }
    return [...nachSatz.entries()]
      .sort(([a], [b]) => a - b)
      .map(([rate, net]) => ({
        rate,
        net: Math.round(net * 100) / 100,
        vat: Math.round(net * (rate / 100) * 100) / 100,
      }))
      .filter((zeile) => zeile.net !== 0);
  }

  private empfaenger(customer: {
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
    salutation: string | null;
    addresses?: Array<{ type: string; street: string; zip: string; city: string }>;
  }) {
    const rechnungsadresse =
      customer.addresses?.find((adresse) => adresse.type === 'RECHNUNG') ?? customer.addresses?.[0];

    const anreden: Record<string, string> = { HERR: 'Herrn', FRAU: 'Frau', FIRMA: '' };

    return {
      anrede: customer.companyName ? null : (anreden[customer.salutation ?? ''] ?? null),
      name:
        customer.companyName ??
        [customer.firstName, customer.lastName].filter(Boolean).join(' ') ??
        '',
      strasse: rechnungsadresse?.street ?? null,
      plz: rechnungsadresse?.zip ?? null,
      ort: rechnungsadresse?.city ?? null,
    };
  }

  /**
   * Briefanrede aus dem Kundenstamm. Ohne bekannte Anrede bleibt es bei der
   * allgemeinen Form – „Sehr geehrte/r Herr/Frau“ liest sich wie ein
   * Serienbrief aus dem Automaten.
   */
  private anrede(customer: {
    salutation: string | null;
    lastName: string | null;
    companyName: string | null;
  }): string {
    if (!customer.companyName && customer.lastName) {
      if (customer.salutation === 'HERR') return `Sehr geehrter Herr ${customer.lastName},`;
      if (customer.salutation === 'FRAU') return `Sehr geehrte Frau ${customer.lastName},`;
    }
    return 'Sehr geehrte Damen und Herren,';
  }

  /* Rechnung ----------------------------------------------------------- */

  async rechnung(id: string): Promise<BelegDatei> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: { include: { addresses: true } },
        items: { orderBy: { position: 'asc' } },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Die Rechnung wurde nicht gefunden.');
    }

    const [firma, kleinunternehmer] = await Promise.all([this.firma(), this.kleinunternehmer()]);
    const positionen = this.positionen(invoice.items);
    const reverseCharge = invoice.customer.reverseCharge === true;

    const brutto = zahl(invoice.grossTotal);
    const abschlag = zahl(invoice.deductedAmount);
    const gezahlt = zahl(invoice.paidAmount);
    const offen = Math.round((brutto - abschlag - gezahlt) * 100) / 100;

    // Der GiroCode enthält den tatsächlich zu zahlenden Betrag, nicht den
    // Bruttobetrag – sonst überweist der Kunde den Abschlag doppelt.
    const giroCode =
      offen > 0 && firma.iban
        ? await renderGiroCode({
            name: firma.name ?? '',
            iban: firma.iban,
            bic: firma.bic,
            amount: offen,
            reference: `Rechnung ${invoice.invoiceNumber}`,
          })
        : null;

    const optionen: BelegOptionen = {
      firma,
      empfaenger: this.empfaenger(invoice.customer),
      kleinunternehmer,
      reverseCharge,
    };

    /*
     * Der Hinweis erscheint nur, solange der Abzug überhaupt noch zu holen
     * ist – also vor der ersten Zahlung. Auf einer teilbezahlten Rechnung wäre
     * er irreführend: der Skonto bezieht sich auf den fristgerechten Ausgleich
     * des ganzen Betrags, nicht auf einen Rest.
     */
    const skontosatz = zahl(invoice.skontoPercent);
    const zahlbetrag = Math.round((brutto - abschlag) * 100) / 100;
    const skontoBetrag = skontoAmount(zahlbetrag, skontosatz);
    const skonto =
      skontosatz > 0 && invoice.skontoDays > 0 && gezahlt === 0 && offen > 0
        ? {
            prozent: skontosatz,
            betrag: skontoBetrag,
            zahlbar: Math.round((zahlbetrag - skontoBetrag) * 100) / 100,
            bis: skontoDeadline(invoice.date, invoice.skontoDays),
          }
        : null;

    const buffer = await renderToBuffer(
      <Rechnung
        daten={{
          invoiceNumber: invoice.invoiceNumber,
          type: invoice.type,
          date: invoice.date,
          dueDate: invoice.dueDate,
          serviceDate: invoice.serviceDate,
          subject: invoice.subject,
          introText: invoice.introText,
          outroText: invoice.outroText,
          customerNumber: invoice.customer.customerNumber,
          netTotal: zahl(invoice.netTotal),
          vatTotal: zahl(invoice.vatTotal),
          grossTotal: brutto,
          deductedAmount: abschlag,
          paidAmount: gezahlt,
          openAmount: offen,
          steuerzeilen: this.steuerzeilen(positionen),
          positionen,
          giroCode,
          skonto,
        }}
        optionen={optionen}
      />,
    );

    return { buffer, dateiname: `${invoice.invoiceNumber}.pdf` };
  }

  /* Angebot ------------------------------------------------------------ */

  async angebot(id: string): Promise<BelegDatei> {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        customer: { include: { addresses: true } },
        items: { orderBy: { position: 'asc' } },
      },
    });
    if (!quote) {
      throw new NotFoundException('Das Angebot wurde nicht gefunden.');
    }

    const [firma, kleinunternehmer] = await Promise.all([this.firma(), this.kleinunternehmer()]);
    const positionen = this.positionen(quote.items);

    const optionen: BelegOptionen = {
      firma,
      empfaenger: this.empfaenger(quote.customer),
      kleinunternehmer,
      reverseCharge: quote.customer.reverseCharge === true,
    };

    const buffer = await renderToBuffer(
      <Angebot
        daten={{
          quoteNumber: quote.quoteNumber,
          date: quote.date,
          validUntil: quote.validUntil,
          subject: quote.subject,
          introText: quote.introText,
          outroText: quote.outroText,
          customerNumber: quote.customer.customerNumber,
          netTotal: zahl(quote.netTotal),
          vatTotal: zahl(quote.vatTotal),
          grossTotal: zahl(quote.grossTotal),
          steuerzeilen: this.steuerzeilen(positionen),
          positionen,
        }}
        optionen={optionen}
      />,
    );

    return { buffer, dateiname: `${quote.quoteNumber}.pdf` };
  }

  /* Prüfprotokoll ------------------------------------------------------- */

  async pruefprotokoll(id: string): Promise<BelegDatei> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id },
      include: {
        door: { include: { customer: { include: { addresses: true } } } },
        checks: { orderBy: { position: 'asc' } },
        defects: { orderBy: [{ severity: 'desc' }, { dueDate: 'asc' }] },
      },
    });
    if (!inspection) {
      throw new NotFoundException('Das Prüfprotokoll wurde nicht gefunden.');
    }

    const [firma, fotos] = await Promise.all([
      this.firma(),
      this.documents.imagesFor(EntityType.INSPECTION, id),
    ]);

    const door = inspection.door;
    const customer = door.customer;

    const buffer = await renderToBuffer(
      <Pruefprotokoll
        daten={{
          inspectionNumber: inspection.inspectionNumber,
          type: inspection.type,
          date: inspection.date,
          inspectorName: inspection.inspectorName,
          result: inspection.result,
          nextDueDate: inspection.nextDueDate,
          summary: inspection.summary,
          recommendation: inspection.recommendation,
          signatureInspector: inspection.signatureInspector,
          signatureCustomer: inspection.signatureCustomer,
          signedByName: inspection.signedByName,
          completedAt: inspection.completedAt,
          customerNumber: customer.customerNumber,
          anlage: {
            doorNumber: door.doorNumber,
            location: door.location,
            type: door.type,
            operationMode: door.operationMode,
            manufacturer: door.manufacturer,
            model: door.model,
            serialNumber: door.serialNumber,
            yearBuilt: door.yearBuilt,
            driveManufacturer: door.driveManufacturer,
            driveModel: door.driveModel,
          },
          pruefpunkte: inspection.checks.map((check) => ({
            position: check.position,
            key: check.key,
            group: check.group,
            label: check.label,
            reference: check.reference,
            result: check.result,
            measuredValue: check.measuredValue === null ? null : zahl(check.measuredValue),
            unit: check.unit,
            limitValue: check.limitValue === null ? null : zahl(check.limitValue),
            comment: check.comment,
          })),
          maengel: inspection.defects.map((defect) => ({
            severity: defect.severity,
            title: defect.title,
            description: defect.description,
            checkKey: defect.checkKey,
            dueDate: defect.dueDate,
          })),
          fotos,
        }}
        optionen={{
          firma,
          // Das Protokoll geht an den Betreiber der Anlage; die Anschrift kommt
          // deshalb aus dem Kundenstamm, wie beim Beleg.
          empfaenger: anschrift(this.empfaenger(customer)),
        }}
      />,
    );

    return { buffer, dateiname: `${inspection.inspectionNumber}.pdf` };
  }

  /* Servicebericht ------------------------------------------------------ */

  async servicebericht(id: string): Promise<BelegDatei> {
    const report = await this.prisma.serviceReport.findUnique({
      where: { id },
      include: {
        door: { include: { customer: { include: { addresses: true } } } },
        order: { include: { customer: { include: { addresses: true } } } },
        technician: true,
        materials: { include: { article: { select: { articleNumber: true } } } },
      },
    });
    if (!report) {
      throw new NotFoundException('Der Servicebericht wurde nicht gefunden.');
    }

    // Der Kunde kann am Auftrag oder an der Anlage hängen; ohne beides bleibt
    // das Anschriftfeld leer, statt den Aufruf scheitern zu lassen.
    const customer = report.order?.customer ?? report.door?.customer ?? null;

    const [firma, fotos] = await Promise.all([
      this.firma(),
      this.documents.imagesFor(EntityType.SERVICE_REPORT, id),
    ]);

    const buffer = await renderToBuffer(
      <Servicebericht
        daten={{
          reportNumber: report.reportNumber,
          status: report.status,
          date: report.date,
          arrivalTime: report.arrivalTime,
          departureTime: report.departureTime,
          workHours: zahl(report.workHours),
          travelHours: zahl(report.travelHours),
          travelKm: zahl(report.travelKm),
          faultDescription: report.faultDescription,
          workPerformed: report.workPerformed,
          followUpRequired: report.followUpRequired,
          followUpNote: report.followUpNote,
          signatureCustomer: report.signatureCustomer,
          signatureTechnician: report.signatureTechnician,
          signedByName: report.signedByName,
          completedAt: report.completedAt,
          technicianName: report.technician
            ? `${report.technician.firstName} ${report.technician.lastName}`
            : '',
          customerNumber: customer?.customerNumber ?? null,
          orderNumber: report.order?.orderNumber ?? null,
          orderSubject: report.order?.subject ?? null,
          anlage: report.door
            ? {
                doorNumber: report.door.doorNumber,
                location: report.door.location,
                manufacturer: report.door.manufacturer,
              }
            : null,
          materialien: report.materials.map((material) => ({
            name: material.name,
            articleNumber: material.article?.articleNumber ?? null,
            quantity: zahl(material.quantity),
            unit: material.unit,
            unitPrice: zahl(material.unitPrice),
          })),
          fotos,
        }}
        optionen={{
          firma,
          empfaenger: customer ? anschrift(this.empfaenger(customer)) : [],
        }}
      />,
    );

    return { buffer, dateiname: `${report.reportNumber}.pdf` };
  }

  /* Mahnung ------------------------------------------------------------- */

  async mahnung(id: string): Promise<BelegDatei> {
    const dunning = await this.prisma.dunning.findUnique({
      where: { id },
      include: { invoice: { include: { customer: { include: { addresses: true } } } } },
    });
    if (!dunning) {
      throw new NotFoundException('Die Mahnung wurde nicht gefunden.');
    }

    const firma = await this.firma();
    const invoice = dunning.invoice;
    const gesamt = zahl(dunning.totalAmount);

    // Der GiroCode trägt die Gesamtforderung samt Gebühr und Zinsen – wer nur
    // den Rechnungsbetrag überweist, bliebe sonst weiter im Verzug.
    const giroCode =
      gesamt > 0 && firma.iban
        ? await renderGiroCode({
            name: firma.name ?? '',
            iban: firma.iban,
            bic: firma.bic ?? null,
            amount: gesamt,
            reference: `Rechnung ${invoice.invoiceNumber}`,
          })
        : null;

    const buffer = await renderToBuffer(
      <Mahnung
        daten={{
          level: dunning.level,
          date: dunning.date,
          dueDate: dunning.dueDate,
          openAmount: zahl(dunning.openAmount),
          fee: zahl(dunning.fee),
          interest: zahl(dunning.interest),
          interestPercent: zahl(dunning.interestPercent),
          totalAmount: gesamt,
          daysOverdue: dunning.daysOverdue,
          customerNumber: invoice.customer.customerNumber,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.date,
          invoiceDueDate: invoice.dueDate,
          invoiceSubject: invoice.subject,
          invoiceGrossTotal: zahl(invoice.grossTotal),
          invoicePaidAmount: zahl(invoice.paidAmount) + zahl(invoice.deductedAmount),
          giroCode,
        }}
        optionen={{
          firma,
          empfaenger: this.empfaenger(invoice.customer),
          anrede: this.anrede(invoice.customer),
        }}
      />,
    );

    return { buffer, dateiname: `Mahnung-${invoice.invoiceNumber}.pdf` };
  }
}
