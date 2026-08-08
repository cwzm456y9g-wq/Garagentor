import { Injectable } from '@nestjs/common';
import {
  calculateDocumentTotals,
  CHART_OF_ACCOUNTS,
  DATEV_DEFAULTS,
  round,
  type ChartOfAccounts,
} from '@garagentor/shared';
import { InvoiceStatus, InvoiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { betrag, feld, toWindows1252 } from './cp1252';
import type { DatevQueryDto } from './dto/datev.dto';

/**
 * Buchungsstapel im DATEV-Format (EXTF).
 *
 * Ausgegeben wird das Rechnungsausgangsbuch: je Rechnung und Steuersatz eine
 * Buchung „Debitor an Erlöskonto“. Zahlungen bleiben außen vor, die bucht die
 * Kanzlei aus dem Kontoauszug – sonst stünde jeder Vorgang doppelt im Stapel.
 *
 * Die Erlöskonten sind Automatikkonten: der Steuerschlüssel ergibt sich in
 * DATEV aus dem Konto, deshalb bleibt das Feld BU-Schlüssel leer.
 */

/** Einstellungen aus dem Schlüssel `datev`. */
export interface DatevEinstellungen {
  kontenrahmen?: ChartOfAccounts;
  beraternummer?: number;
  mandantennummer?: number;
  sachkontenlaenge?: number;
  debitorBasis?: number;
  festschreibung?: boolean;
  erloeskonten?: Record<string, number>;
}

/**
 * Spalten des Buchungsstapels in der Reihenfolge des Formats.
 *
 * Bewusst nach dem Feld „EU-Steuersatz“ abgeschnitten: alles danach sind
 * Zusatzinformationen, die dieser Betrieb nicht füllt. Die Pflichtfelder einer
 * Buchung – Umsatz, Soll/Haben, Konto, Gegenkonto, Belegdatum, Belegfeld 1 und
 * Buchungstext – liegen alle in den ersten vierzehn.
 */
const SPALTEN = [
  'Umsatz (ohne Soll/Haben-Kz)',
  'Soll/Haben-Kennzeichen',
  'WKZ Umsatz',
  'Kurs',
  'Basis-Umsatz',
  'WKZ Basis-Umsatz',
  'Konto',
  'Gegenkonto (ohne BU-Schlüssel)',
  'BU-Schlüssel',
  'Belegdatum',
  'Belegfeld 1',
  'Belegfeld 2',
  'Skonto',
  'Buchungstext',
  'Postensperre',
  'Diverse Adressnummer',
  'Geschäftspartnerbank',
  'Sachverhalt',
  'Zinssperre',
  'Beleglink',
  'Beleginfo - Art 1',
  'Beleginfo - Inhalt 1',
  'Beleginfo - Art 2',
  'Beleginfo - Inhalt 2',
  'Beleginfo - Art 3',
  'Beleginfo - Inhalt 3',
  'Beleginfo - Art 4',
  'Beleginfo - Inhalt 4',
  'Beleginfo - Art 5',
  'Beleginfo - Inhalt 5',
  'Beleginfo - Art 6',
  'Beleginfo - Inhalt 6',
  'Beleginfo - Art 7',
  'Beleginfo - Inhalt 7',
  'Beleginfo - Art 8',
  'Beleginfo - Inhalt 8',
  'KOST1 - Kostenstelle',
  'KOST2 - Kostenstelle',
  'KOST-Menge',
  'EU-Land u. UStID',
  'EU-Steuersatz',
] as const;

/** Eine einzelne Buchung, bevor sie zur Zeile wird. */
export interface Buchung {
  umsatz: number;
  sollHaben: 'S' | 'H';
  konto: number;
  gegenkonto: number;
  belegdatum: Date;
  belegfeld1: string;
  buchungstext: string;
  steuersatz: number;
}

/** Was beim Aufbereiten auffiel und die Kanzlei wissen sollte. */
export interface Beanstandung {
  beleg: string;
  hinweis: string;
}

export interface DatevStapel {
  buchungen: Buchung[];
  beanstandungen: Beanstandung[];
  von: Date;
  bis: Date;
  summe: number;
  einstellungen: Required<Omit<DatevEinstellungen, 'erloeskonten'>> & {
    erloeskonten: Record<string, number>;
  };
}

@Injectable()
export class DatevService {
  constructor(private readonly prisma: PrismaService) {}

  async einstellungen(): Promise<DatevStapel['einstellungen']> {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'datev' } });
    const gespeichert = (setting?.value as DatevEinstellungen | null) ?? {};
    const kontenrahmen = gespeichert.kontenrahmen ?? DATEV_DEFAULTS.kontenrahmen;
    const rahmen = CHART_OF_ACCOUNTS[kontenrahmen] ?? CHART_OF_ACCOUNTS.SKR03;

    return {
      kontenrahmen,
      beraternummer: gespeichert.beraternummer ?? DATEV_DEFAULTS.beraternummer,
      mandantennummer: gespeichert.mandantennummer ?? DATEV_DEFAULTS.mandantennummer,
      sachkontenlaenge: gespeichert.sachkontenlaenge ?? DATEV_DEFAULTS.sachkontenlaenge,
      debitorBasis: gespeichert.debitorBasis ?? rahmen.debitorBasis,
      festschreibung: gespeichert.festschreibung ?? DATEV_DEFAULTS.festschreibung,
      erloeskonten: {
        ...Object.fromEntries(Object.entries(rahmen.erloese).map(([r, k]) => [r, k])),
        ...(gespeichert.erloeskonten ?? {}),
      },
    };
  }

  /**
   * Stellt die Buchungen eines Zeitraums zusammen.
   *
   * Entwürfe und Stornierungen bleiben draußen: ein Entwurf ist kein Beleg,
   * und eine stornierte Rechnung wird über ihre Gutschrift ausgeglichen, die
   * als eigener Beleg im Stapel steht.
   */
  async stapel(query: DatevQueryDto): Promise<DatevStapel> {
    const von = new Date(query.von);
    const bis = new Date(query.bis);
    // Der Endtag gehört dazu; sonst fehlt jedes Mal der Monatsletzte.
    bis.setHours(23, 59, 59, 999);

    const einstellungen = await this.einstellungen();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        date: { gte: von, lte: bis },
        status: { notIn: [InvoiceStatus.ENTWURF, InvoiceStatus.STORNIERT] },
      },
      include: { customer: true, items: { orderBy: { position: 'asc' } } },
      orderBy: { date: 'asc' },
    });

    const buchungen: Buchung[] = [];
    const beanstandungen: Beanstandung[] = [];

    for (const invoice of invoices) {
      const debitor = this.debitorkonto(invoice.customer, einstellungen.debitorBasis);
      if (debitor === null) {
        beanstandungen.push({
          beleg: invoice.invoiceNumber,
          hinweis: `Für den Kunden ${invoice.customer.customerNumber} lässt sich kein Debitorenkonto ableiten. Im Kundenstamm eintragen.`,
        });
        continue;
      }

      const totals = calculateDocumentTotals(
        invoice.items.map((item) => ({
          quantity: item.quantity.toNumber(),
          unitPrice: item.unitPrice.toNumber(),
          discountPercent: item.discountPercent.toNumber(),
          vatRate: item.vatRate.toNumber(),
          type: item.type,
        })),
        invoice.discountPercent.toNumber(),
      );

      // Die Summe der Buchungen muss den Beleg treffen. Weicht sie ab, ist
      // etwas an den Positionen faul – lieber melden als falsch buchen.
      const gebucht = round(
        totals.vatBreakdown.reduce((summe, zeile) => summe + zeile.net + zeile.vat, 0),
      );
      const belegBrutto = Math.abs(invoice.grossTotal.toNumber());
      if (Math.abs(gebucht - belegBrutto) > 0.01) {
        beanstandungen.push({
          beleg: invoice.invoiceNumber,
          hinweis: `Die Positionen ergeben ${gebucht.toFixed(2)} €, der Beleg weist ${belegBrutto.toFixed(2)} € aus.`,
        });
        continue;
      }

      const gutschrift = invoice.type === InvoiceType.GUTSCHRIFT;

      for (const zeile of totals.vatBreakdown) {
        const konto = einstellungen.erloeskonten[String(zeile.rate)];
        if (konto === undefined) {
          beanstandungen.push({
            beleg: invoice.invoiceNumber,
            hinweis: `Für den Steuersatz ${zeile.rate} % ist kein Erlöskonto hinterlegt.`,
          });
          continue;
        }

        buchungen.push({
          umsatz: round(zeile.net + zeile.vat),
          // Die Forderung steht im Soll beim Debitor; eine Gutschrift dreht
          // die Richtung um.
          sollHaben: gutschrift ? 'H' : 'S',
          konto: debitor,
          gegenkonto: konto,
          belegdatum: invoice.date,
          belegfeld1: this.belegfeld(invoice.invoiceNumber),
          buchungstext: this.buchungstext(invoice.subject, invoice.customer),
          steuersatz: zeile.rate,
        });
      }
    }

    return {
      buchungen,
      beanstandungen,
      von,
      bis,
      summe: round(buchungen.reduce((s, b) => s + b.umsatz, 0)),
      einstellungen,
    };
  }

  /** Baut die Datei; die Kodierung ist Windows-1252, wie das Format verlangt. */
  async datei(query: DatevQueryDto): Promise<{ inhalt: Buffer; dateiname: string }> {
    const stapel = await this.stapel(query);
    const zeilen = [
      this.kopfzeile(stapel),
      SPALTEN.map((spalte) => feld(spalte)).join(';'),
      ...stapel.buchungen.map((buchung) => this.buchungszeile(buchung)),
    ];

    // CRLF, wie im Format vorgesehen; die abschließende Leerzeile gehört dazu.
    const inhalt = toWindows1252(`${zeilen.join('\r\n')}\r\n`);
    const dateiname = `EXTF_Buchungsstapel_${this.tag(stapel.von)}_${this.tag(stapel.bis)}.csv`;

    return { inhalt, dateiname };
  }

  /* Zeilenaufbau -------------------------------------------------------- */

  private kopfzeile(stapel: DatevStapel): string {
    const e = stapel.einstellungen;
    const jetzt = new Date();
    const zeitstempel =
      `${jetzt.getFullYear()}${this.zweistellig(jetzt.getMonth() + 1)}${this.zweistellig(jetzt.getDate())}` +
      `${this.zweistellig(jetzt.getHours())}${this.zweistellig(jetzt.getMinutes())}${this.zweistellig(jetzt.getSeconds())}000`;

    return [
      feld('EXTF'), // 1 Kennzeichen
      700, // 2 Versionsnummer
      21, // 3 Formatkategorie: Buchungsstapel
      feld('Buchungsstapel'), // 4 Formatname
      13, // 5 Formatversion
      zeitstempel, // 6 erzeugt am
      '', // 7 importiert
      feld('RE'), // 8 Herkunftskennzeichen
      feld('Garagentor'), // 9 exportiert von
      '', // 10 importiert von
      e.beraternummer, // 11
      e.mandantennummer, // 12
      `${stapel.von.getFullYear()}0101`, // 13 Beginn des Wirtschaftsjahres
      e.sachkontenlaenge, // 14
      this.tag(stapel.von), // 15 Datum von
      this.tag(stapel.bis), // 16 Datum bis
      feld(`Rechnungsausgang ${this.tag(stapel.von)}-${this.tag(stapel.bis)}`), // 17 Bezeichnung
      '', // 18 Diktatkürzel
      1, // 19 Buchungstyp: Finanzbuchführung
      '', // 20 Rechnungslegungszweck
      e.festschreibung ? 1 : 0, // 21
      feld('EUR'), // 22 Währungskennzeichen
      '', // 23 reserviert
      '', // 24 Derivatskennzeichen
      '', // 25 reserviert
      '', // 26 reserviert
      '', // 27 SKR
      '', // 28 Branchenlösung-Id
      '', // 29 reserviert
      '', // 30 reserviert
      '', // 31 Anwendungsinformation
    ].join(';');
  }

  private buchungszeile(buchung: Buchung): string {
    const werte: Array<string | number> = new Array<string>(SPALTEN.length).fill('');

    werte[0] = betrag(buchung.umsatz);
    werte[1] = feld(buchung.sollHaben);
    werte[2] = feld('EUR');
    werte[6] = buchung.konto;
    werte[7] = buchung.gegenkonto;
    // Belegdatum ohne Jahr: das Format nimmt TTMM, das Jahr steht im Kopf.
    werte[9] = `${this.zweistellig(buchung.belegdatum.getDate())}${this.zweistellig(
      buchung.belegdatum.getMonth() + 1,
    )}`;
    werte[10] = feld(buchung.belegfeld1);
    werte[13] = feld(buchung.buchungstext);

    return werte.join(';');
  }

  /* Hilfen -------------------------------------------------------------- */

  /**
   * Debitorenkonto: der Eintrag am Kunden geht vor. Fehlt er, wird die Nummer
   * aus der Kundennummer abgeleitet – aus K-00003 wird 10003.
   */
  private debitorkonto(
    customer: { debtorAccount: number | null; customerNumber: string },
    basis: number,
  ): number | null {
    if (customer.debtorAccount && customer.debtorAccount > 0) return customer.debtorAccount;

    const ziffern = customer.customerNumber.replace(/\D/g, '');
    if (!ziffern) return null;

    const nummer = Number.parseInt(ziffern, 10);
    return Number.isFinite(nummer) ? basis + nummer : null;
  }

  /**
   * Belegfeld 1 nimmt nur einen eingeschränkten Zeichensatz und höchstens 36
   * Stellen; alles andere weist DATEV beim Import ab.
   */
  private belegfeld(nummer: string): string {
    return nummer
      .toUpperCase()
      .replace(/[^A-Z0-9$&%*+\-/]/g, '-')
      .slice(0, 36);
  }

  /** Buchungstext: Betreff und Kunde, auf die zulässigen 60 Zeichen gekürzt. */
  private buchungstext(
    betreff: string,
    customer: { companyName: string | null; firstName: string | null; lastName: string | null },
  ): string {
    const name =
      customer.companyName ?? [customer.firstName, customer.lastName].filter(Boolean).join(' ');
    return `${name ? `${name}, ` : ''}${betreff}`.slice(0, 60);
  }

  private tag(datum: Date): string {
    return `${datum.getFullYear()}${this.zweistellig(datum.getMonth() + 1)}${this.zweistellig(
      datum.getDate(),
    )}`;
  }

  private zweistellig(wert: number): string {
    return `${wert}`.padStart(2, '0');
  }
}
