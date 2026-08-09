import { Text, View } from '@react-pdf/renderer';
import { Abschnitt, Datenblatt, Fotobogen, Unterschrift, type Foto } from './bausteine';
import { Brief, farben, mm, stile, type Firma, type InfoZeile } from './din5008';

/**
 * Servicebericht zu einem Einsatz.
 *
 * Der Bericht wird vor Ort unterschrieben. Die Unterschrift bestätigt, dass die
 * aufgeführten Arbeiten ausgeführt wurden – nicht die Höhe einer späteren
 * Rechnung. Das steht so auch im Ausdruck, damit aus der Gegenzeichnung kein
 * Anerkenntnis der Preise wird.
 */

const euro = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const datumsformat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const uhrzeitformat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
const zahlformat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

const geld = (wert: number): string => `${euro.format(wert)} €`;
const datum = (wert: Date | string | null | undefined): string =>
  wert ? datumsformat.format(new Date(wert)) : '–';
const uhrzeit = (wert: Date | string | null | undefined): string =>
  wert ? `${uhrzeitformat.format(new Date(wert))} Uhr` : '–';

/** Stunden als „2,5 h“; die Zeiterfassung rechnet dezimal. */
const stunden = (wert: number): string => `${zahlformat.format(wert)} h`;

export interface BerichtMaterial {
  name: string;
  articleNumber: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface BerichtDaten {
  reportNumber: string;
  status: string;
  date: Date | string;
  arrivalTime: Date | string | null;
  departureTime: Date | string | null;
  workHours: number;
  travelHours: number;
  travelKm: number;
  faultDescription: string | null;
  workPerformed: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  signatureCustomer: string | null;
  signatureTechnician: string | null;
  signedByName: string | null;
  completedAt: Date | string | null;
  technicianName: string;
  customerNumber: string | null;
  orderNumber: string | null;
  orderSubject: string | null;
  anlage: { doorNumber: string; location: string; manufacturer: string | null } | null;
  materialien: BerichtMaterial[];
  fotos: Foto[];
}

export interface BerichtOptionen {
  firma: Firma;
  empfaenger: string[];
}

function Materialtabelle({ materialien }: { materialien: BerichtMaterial[] }) {
  const summe = materialien.reduce((wert, m) => wert + m.quantity * m.unitPrice, 0);

  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 0.5,
          borderBottomColor: farben.linie,
          paddingBottom: 2,
          marginBottom: 1,
        }}
      >
        <Text style={[stile.klein, stile.fett, { flex: 1 }]}>Bezeichnung</Text>
        <Text style={[stile.klein, stile.fett, stile.rechts, { width: mm(22) }]}>Menge</Text>
        <Text style={[stile.klein, stile.fett, stile.rechts, { width: mm(24) }]}>Einzelpreis</Text>
        <Text style={[stile.klein, stile.fett, stile.rechts, { width: mm(24) }]}>Summe</Text>
      </View>

      {materialien.map((material, index) => (
        <View
          key={`${material.name}-${index}`}
          style={{
            flexDirection: 'row',
            paddingVertical: 1.8,
            borderBottomWidth: 0.3,
            borderBottomColor: farben.linie,
          }}
          wrap={false}
        >
          <View style={{ flex: 1, paddingRight: 4 }}>
            <Text style={stile.klein}>{material.name}</Text>
            {material.articleNumber ? (
              <Text style={[{ fontSize: 6.5 }, stile.blass]}>{material.articleNumber}</Text>
            ) : null}
          </View>
          <Text style={[stile.klein, stile.rechts, { width: mm(22) }]}>
            {zahlformat.format(material.quantity)} {material.unit}
          </Text>
          <Text style={[stile.klein, stile.rechts, { width: mm(24) }]}>
            {geld(material.unitPrice)}
          </Text>
          <Text style={[stile.klein, stile.rechts, stile.fett, { width: mm(24) }]}>
            {geld(material.quantity * material.unitPrice)}
          </Text>
        </View>
      ))}

      <View
        style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 3 }}
        wrap={false}
      >
        <Text style={[stile.klein, stile.leise]}>Materialwert </Text>
        <Text style={[stile.klein, stile.fett, stile.rechts, { width: mm(24) }]}>
          {geld(summe)}
        </Text>
      </View>
    </>
  );
}

export function Servicebericht({
  daten,
  optionen,
}: {
  daten: BerichtDaten;
  optionen: BerichtOptionen;
}) {
  const gegenstand =
    daten.orderSubject ??
    (daten.anlage ? `${daten.anlage.doorNumber}, ${daten.anlage.location}` : 'Serviceeinsatz');

  const infoZeilen: InfoZeile[] = [
    { label: 'Bericht-Nr.', wert: daten.reportNumber },
    { label: 'Einsatzdatum', wert: datum(daten.date) },
    ...(daten.customerNumber ? [{ label: 'Kunden-Nr.', wert: daten.customerNumber }] : []),
    ...(daten.orderNumber ? [{ label: 'Auftrag', wert: daten.orderNumber }] : []),
    { label: 'Monteur', wert: daten.technicianName },
  ];

  const ortUndDatum = [optionen.firma.city, datum(daten.completedAt ?? daten.date)]
    .filter(Boolean)
    .join(', ');

  return (
    <Brief
      firma={optionen.firma}
      empfaenger={optionen.empfaenger}
      betreff={`Servicebericht ${daten.reportNumber} – ${gegenstand}`}
      infoZeilen={infoZeilen}
      fussHinweis={daten.reportNumber}
    >
      <Abschnitt titel="Einsatz">
        <Datenblatt
          eintraege={[
            ['Ankunft', uhrzeit(daten.arrivalTime)],
            ['Abfahrt', uhrzeit(daten.departureTime)],
            ['Arbeitszeit', stunden(daten.workHours)],
            ['Fahrtzeit', stunden(daten.travelHours)],
            ['Strecke', `${zahlformat.format(daten.travelKm)} km`],
            ...(daten.anlage
              ? ([['Anlage', `${daten.anlage.doorNumber}, ${daten.anlage.location}`]] as Array<
                  [string, string]
                >)
              : []),
          ]}
        />
      </Abschnitt>

      {daten.faultDescription ? (
        <Abschnitt titel="Störungsbild">
          <Text style={stile.klein}>{daten.faultDescription}</Text>
        </Abschnitt>
      ) : null}

      <Abschnitt titel="Ausgeführte Arbeiten">
        <Text style={stile.klein}>{daten.workPerformed}</Text>
      </Abschnitt>

      {daten.materialien.length > 0 ? (
        <Abschnitt titel="Verbrauchtes Material">
          <Materialtabelle materialien={daten.materialien} />
        </Abschnitt>
      ) : null}

      {daten.followUpRequired ? (
        <Abschnitt titel="Weitere Arbeiten erforderlich" zusammen>
          <Text style={stile.klein}>
            {daten.followUpNote ??
              'Der Einsatz konnte nicht abschließend erledigt werden; ein Folgetermin ist nötig.'}
          </Text>
        </Abschnitt>
      ) : null}

      <Fotobogen fotos={daten.fotos} beschriften={() => 'Zum Einsatz'} />

      <Abschnitt titel="Bestätigung" zusammen>
        <Text style={[{ fontSize: 7 }, stile.leise, { marginBottom: mm(2) }]}>
          Mit der Unterschrift wird bestätigt, dass die aufgeführten Arbeiten ausgeführt und das
          genannte Material verbraucht wurde. Eine Anerkennung der Rechnungshöhe ist damit nicht
          verbunden; die Abrechnung erfolgt gesondert.
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} wrap={false}>
          <Unterschrift
            rolle="Monteur"
            name={daten.technicianName}
            signatur={daten.signatureTechnician}
            ort={ortUndDatum}
          />
          <Unterschrift
            rolle="Kunde bzw. Beauftragter"
            name={daten.signedByName ?? ''}
            signatur={daten.signatureCustomer}
            ort={ortUndDatum}
          />
        </View>
      </Abschnitt>

      {daten.status === 'ENTWURF' ? (
        <Text style={[{ fontSize: 6.5 }, stile.blass, { marginTop: mm(4) }]}>
          Entwurf – der Bericht ist noch nicht abgeschlossen.
        </Text>
      ) : null}
    </Brief>
  );
}
