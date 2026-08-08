import { Image, Text, View } from '@react-pdf/renderer';
import { Brief, farben, mm, stile, type Firma, type InfoZeile } from './din5008';

/* Formatierung ---------------------------------------------------------- */

const euro = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const datumsformat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const geld = (wert: number): string => `${euro.format(wert)} €`;

const datum = (wert: Date | string | null | undefined): string =>
  wert ? datumsformat.format(new Date(wert)) : '–';

const menge = (wert: number): string =>
  Number.isInteger(wert)
    ? String(wert)
    : new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2 }).format(wert);

/* Daten ---------------------------------------------------------------- */

export interface BelegPosition {
  position: number;
  type: string;
  title: string;
  description?: string | null;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  discountPercent?: number;
  vatRate: number;
  netAmount: number;
  optional?: boolean;
}

export interface BelegEmpfaenger {
  anrede?: string | null;
  name: string;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
}

export interface Steuerzeile {
  rate: number;
  net: number;
  vat: number;
}

export interface BelegOptionen {
  firma: Firma;
  empfaenger: BelegEmpfaenger;
  /** Der Betrieb rechnet nach § 19 UStG ohne Umsatzsteuer ab. */
  kleinunternehmer: boolean;
  /** Steuerschuldnerschaft des Leistungsempfängers nach § 13b UStG. */
  reverseCharge: boolean;
}

/**
 * Ob der Beleg eine Steueraufteilung zeigt.
 *
 * Ausschlaggebend ist der Beleg selbst, nicht die Einstellung: ein Beleg, der
 * unter Regelbesteuerung entstanden ist, trägt Umsatzsteuer im Bruttobetrag.
 * Die Zeile später zu verstecken, würde eine Summe ausweisen, die sich aus den
 * gezeigten Zahlen nicht mehr ergibt.
 */
function zeigtSteuer(vatTotal: number): boolean {
  return Math.abs(vatTotal) >= 0.005;
}

/* Positionstabelle ----------------------------------------------------- */

const SPALTEN = {
  pos: 8,
  bezeichnung: 0, // nimmt den Rest
  menge: 16,
  einzel: 20,
  ust: 11,
  netto: 22,
} as const;

function Kopfzeile({ mitSteuer }: { mitSteuer: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        borderBottomWidth: 0.7,
        borderBottomColor: farben.ink,
        paddingBottom: 3,
        marginBottom: 3,
      }}
      fixed
    >
      <Text style={[stile.klein, stile.fett, { width: mm(SPALTEN.pos) }]}>Pos.</Text>
      <Text style={[stile.klein, stile.fett, { flex: 1 }]}>Bezeichnung</Text>
      <Text style={[stile.klein, stile.fett, stile.rechts, { width: mm(SPALTEN.menge) }]}>
        Menge
      </Text>
      <Text style={[stile.klein, stile.fett, stile.rechts, { width: mm(SPALTEN.einzel) }]}>
        Einzelpreis
      </Text>
      {mitSteuer ? (
        <Text style={[stile.klein, stile.fett, stile.rechts, { width: mm(SPALTEN.ust) }]}>USt</Text>
      ) : null}
      <Text style={[stile.klein, stile.fett, stile.rechts, { width: mm(SPALTEN.netto) }]}>
        Betrag
      </Text>
    </View>
  );
}

function Zeile({ pos, mitSteuer }: { pos: BelegPosition; mitSteuer: boolean }) {
  const nurText = pos.type === 'TEXT' || pos.type === 'ZWISCHENSUMME';

  return (
    // wrap={false} hält eine Position zusammen: eine Bezeichnung ohne ihren
    // Betrag auf der Folgeseite wäre unlesbar.
    <View
      style={{
        flexDirection: 'row',
        paddingVertical: 2.5,
        borderBottomWidth: 0.4,
        borderBottomColor: farben.linie,
      }}
      wrap={false}
    >
      <Text style={[stile.leise, { width: mm(SPALTEN.pos) }]}>{nurText ? '' : pos.position}</Text>
      <View style={{ flex: 1, paddingRight: 4 }}>
        <Text style={nurText ? stile.leise : undefined}>
          {pos.title}
          {pos.optional ? '  (optional)' : ''}
        </Text>
        {pos.description ? <Text style={[stile.klein, stile.leise]}>{pos.description}</Text> : null}
        {pos.discountPercent ? (
          <Text style={[stile.klein, stile.leise]}>
            abzüglich {menge(pos.discountPercent)} % Nachlass
          </Text>
        ) : null}
      </View>
      <Text style={[stile.rechts, { width: mm(SPALTEN.menge) }]}>
        {nurText ? '' : `${menge(pos.quantity)} ${pos.unit ?? ''}`.trim()}
      </Text>
      <Text style={[stile.rechts, { width: mm(SPALTEN.einzel) }]}>
        {nurText ? '' : geld(pos.unitPrice)}
      </Text>
      {mitSteuer ? (
        <Text style={[stile.rechts, { width: mm(SPALTEN.ust) }]}>
          {nurText ? '' : `${menge(pos.vatRate)} %`}
        </Text>
      ) : null}
      <Text style={[stile.rechts, stile.fett, { width: mm(SPALTEN.netto) }]}>
        {nurText || pos.optional ? '' : geld(pos.netAmount)}
      </Text>
    </View>
  );
}

function Summenblock({
  netto,
  steuerzeilen,
  brutto,
  rabatt,
  zwischensumme,
  abschlag,
  gezahlt,
  offen,
  mitSteuer,
}: {
  netto: number;
  steuerzeilen: Steuerzeile[];
  brutto: number;
  rabatt?: number;
  zwischensumme?: number;
  abschlag?: number;
  gezahlt?: number;
  offen?: number;
  mitSteuer: boolean;
}) {
  const zeile = (beschriftung: string, wert: string, hervorgehoben = false, mitLinie = false) => (
    <View
      key={beschriftung}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 1.5,
        ...(mitLinie ? { borderTopWidth: 0.7, borderTopColor: farben.ink, marginTop: 2 } : {}),
      }}
    >
      <Text style={hervorgehoben ? stile.fett : undefined}>{beschriftung}</Text>
      <Text style={hervorgehoben ? stile.fett : undefined}>{wert}</Text>
    </View>
  );

  return (
    <View style={{ marginTop: mm(4), alignItems: 'flex-end' }} wrap={false}>
      <View style={{ width: mm(80) }}>
        {rabatt
          ? [
              zeile('Zwischensumme', geld(zwischensumme ?? netto + rabatt)),
              zeile('Nachlass', `− ${geld(rabatt)}`),
            ]
          : null}
        {zeile(mitSteuer ? 'Summe netto' : 'Summe', geld(netto))}
        {mitSteuer
          ? steuerzeilen.map((s) => zeile(`zzgl. ${menge(s.rate)} % Umsatzsteuer`, geld(s.vat)))
          : null}
        {zeile(mitSteuer ? 'Gesamtbetrag' : 'Rechnungsbetrag', geld(brutto), true, true)}
        {abschlag ? zeile('abzüglich Abschlag', `− ${geld(abschlag)}`) : null}
        {gezahlt ? zeile('abzüglich Zahlung', `− ${geld(gezahlt)}`) : null}
        {offen !== undefined && (abschlag || gezahlt)
          ? zeile('Offener Betrag', geld(offen), true)
          : null}
      </View>
    </View>
  );
}

function anschrift(empfaenger: BelegEmpfaenger): string[] {
  return [
    empfaenger.anrede ?? '',
    empfaenger.name,
    empfaenger.strasse ?? '',
    [empfaenger.plz, empfaenger.ort].filter(Boolean).join(' '),
  ].filter((zeile) => zeile.trim().length > 0);
}

/** Pflichthinweise unterhalb des Summenblocks. */
function Hinweise({
  kleinunternehmer,
  reverseCharge,
}: {
  kleinunternehmer: boolean;
  reverseCharge: boolean;
}) {
  if (!kleinunternehmer && !reverseCharge) return null;
  return (
    <View style={{ marginTop: mm(3) }}>
      {kleinunternehmer ? (
        <Text style={[stile.klein, stile.leise]}>
          Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.
        </Text>
      ) : null}
      {reverseCharge ? (
        <Text style={[stile.klein, stile.leise]}>
          Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG.
        </Text>
      ) : null}
    </View>
  );
}

/* Rechnung ------------------------------------------------------------- */

export interface RechnungDaten {
  invoiceNumber: string;
  type: string;
  date: Date | string;
  dueDate: Date | string;
  serviceDate?: Date | string | null;
  subject: string;
  introText?: string | null;
  outroText?: string | null;
  customerNumber?: string | null;
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
  discountAmount?: number;
  subtotal?: number;
  deductedAmount?: number;
  paidAmount?: number;
  openAmount?: number;
  steuerzeilen: Steuerzeile[];
  positionen: BelegPosition[];
  /** Bereits erzeugter GiroCode als Data-URL. */
  giroCode?: string | null;
}

export function Rechnung({ daten, optionen }: { daten: RechnungDaten; optionen: BelegOptionen }) {
  const mitSteuer = zeigtSteuer(daten.vatTotal);
  const bezeichnung = daten.type === 'GUTSCHRIFT' ? 'Gutschrift' : 'Rechnung';

  const infoZeilen: InfoZeile[] = [
    { label: `${bezeichnung}-Nr.`, wert: daten.invoiceNumber },
    { label: 'Datum', wert: datum(daten.date) },
    ...(daten.customerNumber ? [{ label: 'Kunden-Nr.', wert: daten.customerNumber }] : []),
    ...(daten.serviceDate ? [{ label: 'Leistungsdatum', wert: datum(daten.serviceDate) }] : []),
    { label: 'Fällig am', wert: datum(daten.dueDate) },
  ];

  return (
    <Brief
      firma={optionen.firma}
      empfaenger={anschrift(optionen.empfaenger)}
      betreff={`${bezeichnung} ${daten.invoiceNumber} – ${daten.subject}`}
      infoZeilen={infoZeilen}
      fussHinweis={daten.invoiceNumber}
    >
      {daten.introText ? <Text style={{ marginBottom: mm(3) }}>{daten.introText}</Text> : null}

      <Kopfzeile mitSteuer={mitSteuer} />
      {daten.positionen.map((pos) => (
        <Zeile key={`${pos.position}-${pos.title}`} pos={pos} mitSteuer={mitSteuer} />
      ))}

      <Summenblock
        netto={daten.netTotal}
        steuerzeilen={daten.steuerzeilen}
        brutto={daten.grossTotal}
        rabatt={daten.discountAmount}
        zwischensumme={daten.subtotal}
        abschlag={daten.deductedAmount}
        gezahlt={daten.paidAmount}
        offen={daten.openAmount}
        mitSteuer={mitSteuer}
      />

      <Hinweise
        // Nur wenn der Beleg tatsächlich ohne Steuer auskommt – sonst stünde
        // der Hinweis unter einer ausgewiesenen Umsatzsteuer.
        kleinunternehmer={optionen.kleinunternehmer && !mitSteuer}
        reverseCharge={optionen.reverseCharge && !mitSteuer}
      />

      {daten.outroText ? <Text style={{ marginTop: mm(4) }}>{daten.outroText}</Text> : null}

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
    </Brief>
  );
}

/* Angebot -------------------------------------------------------------- */

export interface AngebotDaten {
  quoteNumber: string;
  date: Date | string;
  validUntil: Date | string;
  subject: string;
  introText?: string | null;
  outroText?: string | null;
  customerNumber?: string | null;
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
  discountAmount?: number;
  subtotal?: number;
  steuerzeilen: Steuerzeile[];
  positionen: BelegPosition[];
}

export function Angebot({ daten, optionen }: { daten: AngebotDaten; optionen: BelegOptionen }) {
  const mitSteuer = zeigtSteuer(daten.vatTotal);
  const hatOptionale = daten.positionen.some((pos) => pos.optional);

  const infoZeilen: InfoZeile[] = [
    { label: 'Angebot-Nr.', wert: daten.quoteNumber },
    { label: 'Datum', wert: datum(daten.date) },
    ...(daten.customerNumber ? [{ label: 'Kunden-Nr.', wert: daten.customerNumber }] : []),
    { label: 'Gültig bis', wert: datum(daten.validUntil) },
  ];

  return (
    <Brief
      firma={optionen.firma}
      empfaenger={anschrift(optionen.empfaenger)}
      betreff={`Angebot ${daten.quoteNumber} – ${daten.subject}`}
      infoZeilen={infoZeilen}
      fussHinweis={daten.quoteNumber}
    >
      {daten.introText ? <Text style={{ marginBottom: mm(3) }}>{daten.introText}</Text> : null}

      <Kopfzeile mitSteuer={mitSteuer} />
      {daten.positionen.map((pos) => (
        <Zeile key={`${pos.position}-${pos.title}`} pos={pos} mitSteuer={mitSteuer} />
      ))}

      <Summenblock
        netto={daten.netTotal}
        steuerzeilen={daten.steuerzeilen}
        brutto={daten.grossTotal}
        rabatt={daten.discountAmount}
        zwischensumme={daten.subtotal}
        mitSteuer={mitSteuer}
      />

      {hatOptionale ? (
        <Text style={[stile.klein, stile.leise, { marginTop: mm(2) }]}>
          Als optional gekennzeichnete Positionen sind in der Summe nicht enthalten.
        </Text>
      ) : null}

      <Hinweise
        // Nur wenn der Beleg tatsächlich ohne Steuer auskommt – sonst stünde
        // der Hinweis unter einer ausgewiesenen Umsatzsteuer.
        kleinunternehmer={optionen.kleinunternehmer && !mitSteuer}
        reverseCharge={optionen.reverseCharge && !mitSteuer}
      />

      {daten.outroText ? <Text style={{ marginTop: mm(4) }}>{daten.outroText}</Text> : null}
    </Brief>
  );
}
