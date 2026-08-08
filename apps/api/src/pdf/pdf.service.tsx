import { Injectable, NotFoundException } from '@nestjs/common';
import { renderToBuffer } from '@react-pdf/renderer';
import { PrismaService } from '../prisma/prisma.service';
import { Angebot, Rechnung, type BelegOptionen, type BelegPosition } from './belege';
import type { Firma } from './din5008';
import { renderGiroCode } from './girocode';

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
  constructor(private readonly prisma: PrismaService) {}

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
}
