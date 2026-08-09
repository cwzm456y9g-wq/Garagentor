import { Image, Text, View } from '@react-pdf/renderer';
import { anschrift, type BelegEmpfaenger } from './belege';
import { Brief, farben, mm, stile, type Firma, type InfoZeile } from './din5008';
import { mahntext } from './mahnung.werte';

/**
 * Mahnung zu einer Rechnung.
 *
 * Der Aufbau folgt dem, was eine Mahnung leisten muss: die Forderung muss aus
 * dem Schreiben heraus nachvollziehbar sein. Deshalb steht die Aufstellung vom
 * Rechnungsbetrag über bereits geleistete Zahlungen bis zur Gesamtforderung
 * offen da, und der Zinssatz wird genannt statt nur der Zinsbetrag.
 */

const euro = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const datumsformat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const prozent = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

const geld = (wert: number): string => `${euro.format(wert)} €`;
const datum = (wert: Date | string | null | undefined): string =>
  wert ? datumsformat.format(new Date(wert)) : '–';

export interface MahnungDaten {
  level: string;
  date: Date | string;
  /** Neue Zahlungsfrist aus der Mahnung. */
  dueDate: Date | string;
  openAmount: number;
  fee: number;
  interest: number;
  interestPercent: number;
  totalAmount: number;
  daysOverdue: number;
  customerNumber: string | null;
  invoiceNumber: string;
  invoiceDate: Date | string;
  invoiceDueDate: Date | string;
  invoiceSubject: string;
  invoiceGrossTotal: number;
  invoicePaidAmount: number;
  /** Bereits erzeugter GiroCode über die Gesamtforderung. */
  giroCode?: string | null;
}

export interface MahnungOptionen {
  firma: Firma;
  empfaenger: BelegEmpfaenger;
  /** Fertige Anrede, z. B. „Sehr geehrte Frau Hoffmann,“. */
  anrede: string;
}

/** Eine Zeile der Forderungsaufstellung. */
function Posten({
  beschriftung,
  zusatz,
  betrag,
  abzug = false,
  summe = false,
}: {
  beschriftung: string;
  zusatz?: string;
  betrag: number;
  abzug?: boolean;
  summe?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 2,
        ...(summe
          ? { borderTopWidth: 0.7, borderTopColor: farben.ink, marginTop: 2, paddingTop: 3 }
          : { borderBottomWidth: 0.3, borderBottomColor: farben.linie }),
      }}
    >
      <View style={{ flex: 1, paddingRight: mm(4) }}>
        <Text style={summe ? stile.fett : undefined}>{beschriftung}</Text>
        {zusatz ? <Text style={[stile.klein, stile.leise]}>{zusatz}</Text> : null}
      </View>
      <Text style={[stile.rechts, summe ? stile.fett : {}]}>
        {abzug ? `− ${geld(betrag)}` : geld(betrag)}
      </Text>
    </View>
  );
}

export function Mahnung({ daten, optionen }: { daten: MahnungDaten; optionen: MahnungOptionen }) {
  const frist = datum(daten.dueDate);
  const { bezeichnung, anschreiben, schluss } = mahntext(daten.level, frist);

  const infoZeilen: InfoZeile[] = [
    { label: 'Rechnungs-Nr.', wert: daten.invoiceNumber },
    { label: 'Rechnung vom', wert: datum(daten.invoiceDate) },
    ...(daten.customerNumber ? [{ label: 'Kunden-Nr.', wert: daten.customerNumber }] : []),
    { label: 'Datum', wert: datum(daten.date) },
    { label: 'Zahlbar bis', wert: frist },
  ];

  return (
    <Brief
      firma={optionen.firma}
      empfaenger={anschrift(optionen.empfaenger)}
      betreff={`${bezeichnung} zu Rechnung ${daten.invoiceNumber}`}
      infoZeilen={infoZeilen}
      fussHinweis={`${bezeichnung} · ${daten.invoiceNumber}`}
    >
      <Text style={{ marginBottom: mm(2) }}>{optionen.anrede}</Text>
      <Text style={{ marginBottom: mm(4) }}>{anschreiben}</Text>

      <View style={{ marginBottom: mm(3) }}>
        <Text style={[stile.fett, { fontSize: 10 }]}>
          Rechnung {daten.invoiceNumber} – {daten.invoiceSubject}
        </Text>
        <Text style={[stile.klein, stile.leise]}>
          Fällig war der Betrag am {datum(daten.invoiceDueDate)}, also seit {daten.daysOverdue}{' '}
          {daten.daysOverdue === 1 ? 'Tag' : 'Tagen'}.
        </Text>
      </View>

      <View wrap={false}>
        <Posten beschriftung="Rechnungsbetrag" betrag={daten.invoiceGrossTotal} />
        {/* Teilzahlungen aufschlüsseln. Ohne sie wäre der offene Betrag mit dem
            Rechnungsbetrag identisch – eine Zeile, die nichts erklärt. */}
        {daten.invoicePaidAmount > 0 ? (
          <>
            <Posten beschriftung="bereits gezahlt" betrag={daten.invoicePaidAmount} abzug />
            <Posten beschriftung="Offener Betrag" betrag={daten.openAmount} />
          </>
        ) : null}
        {daten.fee > 0 ? <Posten beschriftung="Mahngebühr" betrag={daten.fee} /> : null}
        {daten.interest > 0 ? (
          <Posten
            beschriftung="Verzugszinsen"
            // Der Satz gehört ins Schreiben: der Basiszinssatz nach § 247 BGB
            // wechselt halbjährlich, im Nachhinein wäre der Betrag sonst nicht
            // mehr nachzurechnen.
            zusatz={`${prozent.format(daten.interestPercent)} % p. a. nach § 288 BGB für ${
              daten.daysOverdue
            } Tage`}
            betrag={daten.interest}
          />
        ) : null}
        <Posten beschriftung="Gesamtforderung" betrag={daten.totalAmount} summe />
      </View>

      <Text style={{ marginTop: mm(4) }}>{schluss}</Text>

      {optionen.firma.iban ? (
        <Text style={[stile.klein, stile.leise, { marginTop: mm(2) }]}>
          Bitte überweisen Sie auf {optionen.firma.iban}
          {optionen.firma.bankName ? ` bei der ${optionen.firma.bankName}` : ''} unter Angabe der
          Rechnungsnummer {daten.invoiceNumber}.
        </Text>
      ) : null}

      {daten.giroCode ? (
        <View style={{ marginTop: mm(5), flexDirection: 'row' }} wrap={false}>
          <Image src={daten.giroCode} style={{ width: mm(24), height: mm(24) }} />
          <View style={{ marginLeft: mm(3), justifyContent: 'center' }}>
            <Text style={[stile.klein, stile.fett]}>Überweisen per GiroCode</Text>
            <Text style={[stile.klein, stile.leise]}>
              Mit der Banking-App abfotografieren – Empfänger, Betrag und
            </Text>
            <Text style={[stile.klein, stile.leise]}>
              Verwendungszweck sind dann bereits ausgefüllt.
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={{ marginTop: mm(5) }}>Mit freundlichen Grüßen</Text>
      <Text style={{ marginTop: mm(6) }}>{optionen.firma.name ?? ''}</Text>
    </Brief>
  );
}
