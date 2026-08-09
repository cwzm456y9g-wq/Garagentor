import { prisma } from '@/server/prisma';
import { pdf } from '../pdf/pdf.service';
import {
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@/server/nest-ersatz';

import { dunningLevelLabels, type MailDocumentType, type Paginated } from '@garagentor/shared';
import { EntityType, MailStatus } from '@prisma/client';
import { createTransport, type Transporter } from 'nodemailer';
import { aktuelleBenutzerId as currentUserId } from '@/server/kontext';
import { paginate } from '@/server/anfrage';
import { konfiguration, type Konfiguration } from '@/server/konfiguration';

import type { MailLogQueryDto, SendMailDto } from './dto/mail.dto';
import {
  empfaengerListe,
  istEmpfaengerGueltig,
  mitSignatur,
  setzePlatzhalter,
  vorlageFuer,
  type MailVorlage,
  type Platzhalter,
} from './vorlagen';

/** Was ein Beleg zum Anschreiben beisteuert. */
interface BelegDaten {
  entityType: EntityType;
  reference: string;
  empfaenger: string | null;
  platzhalter: Platzhalter;
}

/** Einstellungen des Postausgangs, soweit sie nicht in der Umgebung stehen. */
interface MailEinstellungen {
  absender?: string;
  antwortAn?: string;
  signatur?: string;
  vorlagen?: Partial<Record<MailDocumentType, Partial<MailVorlage>>>;
}

const euro = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const datumsformat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const geld = (wert: { toNumber(): number } | number): string =>
  `${euro.format(typeof wert === 'number' ? wert : wert.toNumber())} €`;
const datum = (wert: Date | null): string => (wert ? datumsformat.format(wert) : '');

export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  private get einstellungenAusUmgebung(): Konfiguration['mail'] {
    return konfiguration().mail;
  }

  /** Ob überhaupt ein Postausgang hinterlegt ist. */
  eingerichtet(): boolean {
    const mail = this.einstellungenAusUmgebung;
    return Boolean(mail.host && mail.from);
  }

  /**
   * Zustand des Postausgangs für die Oberfläche. Die Zugangsdaten selbst
   * verlassen den Server nicht – nur, ob sie gesetzt sind.
   */
  status() {
    const mail = this.einstellungenAusUmgebung;
    return {
      eingerichtet: this.eingerichtet(),
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      absender: mail.from,
      antwortAn: mail.replyTo,
      kopieAn: mail.bcc,
    };
  }

  /* Vorschau und Versand ------------------------------------------------ */

  /** Füllt das Anschreiben, ohne etwas zu verschicken. */
  async vorschau(art: MailDocumentType, id: string) {
    const beleg = await this.belegDaten(art, id);
    const einstellungen = await this.einstellungen();
    const vorlage = vorlageFuer(art, einstellungen.vorlagen);

    return {
      art,
      an: beleg.empfaenger ?? '',
      betreff: setzePlatzhalter(vorlage.betreff, beleg.platzhalter),
      text: mitSignatur(
        setzePlatzhalter(vorlage.text, beleg.platzhalter),
        einstellungen.signatur ?? (await this.signaturAusFirma()),
      ),
      anhang: `${beleg.reference}.pdf`,
      /** Fehlt beim Kunden die Adresse, muss sie von Hand ergänzt werden. */
      empfaengerFehlt: !beleg.empfaenger,
    };
  }

  /**
   * Verschickt einen Beleg als PDF-Anhang und schreibt das Ergebnis ins
   * Versandprotokoll – auch den Fehlschlag. Ein Versand, von dem niemand
   * weiß, ob er ankam, ist im Streitfall wertlos.
   */
  async senden(dto: SendMailDto) {
    const beleg = await this.belegDaten(dto.art, dto.id);
    const empfaenger = empfaengerListe(dto.an);
    const kopie = empfaengerListe(dto.kopie);

    if (empfaenger.length === 0) {
      throw new BadRequestException('Es wurde kein Empfänger angegeben.');
    }
    const ungueltig = [...empfaenger, ...kopie].find((adresse) => !istEmpfaengerGueltig(adresse));
    if (ungueltig) {
      throw new BadRequestException(`"${ungueltig}" ist keine gültige E-Mail-Adresse.`);
    }

    const mail = this.einstellungenAusUmgebung;
    if (!this.eingerichtet()) {
      throw new ServiceUnavailableException(
        'Der Postausgang ist nicht eingerichtet. MAIL_HOST und MAIL_FROM gehören in die ' +
          'Umgebung des Servers.',
      );
    }

    const einstellungen = await this.einstellungen();
    const { buffer, dateiname } = await this.belegAlsPdf(dto.art, dto.id);

    let status: MailStatus = MailStatus.GESENDET;
    let fehler: string | null = null;
    let messageId: string | null = null;

    try {
      const ergebnis = await this.transport().sendMail({
        from: einstellungen.absender
          ? `${einstellungen.absender} <${mail.from}>`
          : (mail.from ?? undefined),
        to: empfaenger,
        ...(kopie.length > 0 ? { cc: kopie } : {}),
        ...(mail.bcc ? { bcc: mail.bcc } : {}),
        ...(einstellungen.antwortAn || mail.replyTo
          ? { replyTo: einstellungen.antwortAn || mail.replyTo! }
          : {}),
        subject: dto.betreff,
        text: dto.text,
        attachments: [{ filename: dateiname, content: buffer, contentType: 'application/pdf' }],
      });
      messageId = ergebnis.messageId ?? null;
    } catch (error) {
      status = MailStatus.FEHLGESCHLAGEN;
      fehler = error instanceof Error ? error.message : String(error);
      this.logger.error(`Versand von ${beleg.reference} an ${dto.an} fehlgeschlagen: ${fehler}`);
    }

    const protokoll = await prisma.mailLog.create({
      data: {
        entityType: beleg.entityType,
        entityId: dto.id,
        reference: beleg.reference,
        recipient: empfaenger.join(', '),
        cc: kopie.length > 0 ? kopie.join(', ') : null,
        subject: dto.betreff,
        body: dto.text,
        attachments: [dateiname],
        status,
        error: fehler,
        messageId,
        sentById: currentUserId() ?? null,
      },
    });

    if (status === MailStatus.FEHLGESCHLAGEN) {
      throw new ServiceUnavailableException(
        `Der Versand ist fehlgeschlagen: ${fehler ?? 'unbekannter Grund'}`,
      );
    }

    // Erst nach erfolgreichem Versand: eine Mahnung gilt sonst als
    // hinausgegangen, obwohl der Mailserver sie abgewiesen hat.
    await this.vermerkeVersand(dto.art, dto.id);

    return protokoll;
  }

  /* Versandprotokoll ---------------------------------------------------- */

  async findAll(query: MailLogQueryDto): Promise<Paginated<unknown>> {
    const where = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' as const } },
              { recipient: { contains: query.search, mode: 'insensitive' as const } },
              { subject: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.mailLog.findMany({
        where,
        include: { sentBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      prisma.mailLog.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  /* Innereien ------------------------------------------------------------ */

  private transport(): Transporter {
    if (this.transporter) return this.transporter;

    const mail = this.einstellungenAusUmgebung;
    this.transporter = createTransport({
      host: mail.host!,
      port: mail.port,
      secure: mail.secure,
      ...(mail.user && mail.password ? { auth: { user: mail.user, pass: mail.password } } : {}),
    });
    return this.transporter;
  }

  private async einstellungen(): Promise<MailEinstellungen> {
    const setting = await prisma.setting.findUnique({ where: { key: 'mail' } });
    return (setting?.value as MailEinstellungen | null) ?? {};
  }

  /** Ohne gepflegte Signatur wird eine aus den Firmendaten gebaut. */
  private async signaturAusFirma(): Promise<string> {
    const setting = await prisma.setting.findUnique({ where: { key: 'firma' } });
    const firma =
      (setting?.value as {
        name?: string;
        street?: string;
        zip?: string;
        city?: string;
        phone?: string;
        email?: string;
      } | null) ?? {};

    return [
      firma.name,
      firma.street,
      [firma.zip, firma.city].filter(Boolean).join(' '),
      firma.phone ? `Telefon ${firma.phone}` : null,
      firma.email,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private belegAlsPdf(art: MailDocumentType, id: string) {
    switch (art) {
      case 'ANGEBOT':
        return pdf.angebot(id);
      case 'RECHNUNG':
        return pdf.rechnung(id);
      case 'MAHNUNG':
        return pdf.mahnung(id);
      case 'SERVICEBERICHT':
        return pdf.servicebericht(id);
      case 'PRUEFPROTOKOLL':
        return pdf.pruefprotokoll(id);
    }
  }

  /**
   * Hält im Beleg fest, dass er hinausgegangen ist. Bei Rechnung und Mahnung
   * hängt daran der weitere Ablauf – die Mahnfrist zählt ab dem Versand.
   */
  private async vermerkeVersand(art: MailDocumentType, id: string): Promise<void> {
    try {
      if (art === 'MAHNUNG') {
        await prisma.dunning.updateMany({
          where: { id, sentAt: null },
          data: { status: 'VERSENDET', sentAt: new Date() },
        });
      }
      if (art === 'RECHNUNG') {
        await prisma.invoice.updateMany({
          where: { id, sentAt: null },
          data: { sentAt: new Date() },
        });
      }
    } catch (error) {
      // Die Mail ist raus; daran ändert ein misslungener Vermerk nichts.
      this.logger.warn(`Versandvermerk für ${art} ${id} fehlgeschlagen: ${error}`);
    }
  }

  /** Empfänger, Belegnummer und Platzhalter der jeweiligen Belegart. */
  private async belegDaten(art: MailDocumentType, id: string): Promise<BelegDaten> {
    const firma = await prisma.setting.findUnique({ where: { key: 'firma' } });
    const firmenname = (firma?.value as { name?: string } | null)?.name ?? '';

    switch (art) {
      case 'ANGEBOT': {
        const quote = await prisma.quote.findUnique({
          where: { id },
          include: { customer: true },
        });
        if (!quote) throw new NotFoundException('Das Angebot wurde nicht gefunden.');

        return {
          entityType: EntityType.QUOTE,
          reference: quote.quoteNumber,
          empfaenger: quote.customer.email,
          platzhalter: {
            anrede: this.anrede(quote.customer),
            kunde: this.kundenname(quote.customer),
            nummer: quote.quoteNumber,
            betreff: quote.subject,
            datum: datum(quote.date),
            betrag: geld(quote.grossTotal),
            faellig: datum(quote.validUntil),
            firma: firmenname,
          },
        };
      }

      case 'RECHNUNG': {
        const invoice = await prisma.invoice.findUnique({
          where: { id },
          include: { customer: true },
        });
        if (!invoice) throw new NotFoundException('Die Rechnung wurde nicht gefunden.');

        return {
          entityType: EntityType.INVOICE,
          reference: invoice.invoiceNumber,
          empfaenger: invoice.customer.email,
          platzhalter: {
            anrede: this.anrede(invoice.customer),
            kunde: this.kundenname(invoice.customer),
            nummer: invoice.invoiceNumber,
            betreff: invoice.subject,
            datum: datum(invoice.date),
            betrag: geld(invoice.grossTotal),
            faellig: datum(invoice.dueDate),
            firma: firmenname,
          },
        };
      }

      case 'MAHNUNG': {
        const dunning = await prisma.dunning.findUnique({
          where: { id },
          include: { invoice: { include: { customer: true } } },
        });
        if (!dunning) throw new NotFoundException('Die Mahnung wurde nicht gefunden.');

        return {
          entityType: EntityType.INVOICE,
          reference: `Mahnung-${dunning.invoice.invoiceNumber}`,
          empfaenger: dunning.invoice.customer.email,
          platzhalter: {
            anrede: this.anrede(dunning.invoice.customer),
            kunde: this.kundenname(dunning.invoice.customer),
            nummer: dunning.invoice.invoiceNumber,
            betreff: dunning.invoice.subject,
            datum: datum(dunning.date),
            betrag: geld(dunning.totalAmount),
            faellig: datum(dunning.dueDate),
            stufe: dunningLevelLabels[dunning.level],
            firma: firmenname,
          },
        };
      }

      case 'SERVICEBERICHT': {
        const report = await prisma.serviceReport.findUnique({
          where: { id },
          include: {
            door: { include: { customer: true } },
            order: { include: { customer: true } },
          },
        });
        if (!report) throw new NotFoundException('Der Servicebericht wurde nicht gefunden.');

        const customer = report.order?.customer ?? report.door?.customer ?? null;

        return {
          entityType: EntityType.SERVICE_REPORT,
          reference: report.reportNumber,
          empfaenger: customer?.email ?? null,
          platzhalter: {
            anrede: customer ? this.anrede(customer) : 'Sehr geehrte Damen und Herren,',
            kunde: customer ? this.kundenname(customer) : '',
            nummer: report.reportNumber,
            betreff: report.order?.subject ?? 'Serviceeinsatz',
            datum: datum(report.date),
            anlage: report.door ? `${report.door.doorNumber}, ${report.door.location}` : '',
            firma: firmenname,
          },
        };
      }

      case 'PRUEFPROTOKOLL': {
        const inspection = await prisma.inspection.findUnique({
          where: { id },
          include: { door: { include: { customer: true } } },
        });
        if (!inspection) throw new NotFoundException('Das Prüfprotokoll wurde nicht gefunden.');

        return {
          entityType: EntityType.INSPECTION,
          reference: inspection.inspectionNumber,
          empfaenger: inspection.door.customer.email,
          platzhalter: {
            anrede: this.anrede(inspection.door.customer),
            kunde: this.kundenname(inspection.door.customer),
            nummer: inspection.inspectionNumber,
            betreff: `Prüfung ${inspection.door.doorNumber}`,
            datum: datum(inspection.date),
            faellig: datum(inspection.nextDueDate),
            anlage: `${inspection.door.doorNumber}, ${inspection.door.location}`,
            firma: firmenname,
          },
        };
      }
    }
  }

  private kundenname(customer: {
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
  }): string {
    return (
      customer.companyName ??
      [customer.firstName, customer.lastName].filter(Boolean).join(' ') ??
      ''
    );
  }

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
}

export const mailService = new MailService();
