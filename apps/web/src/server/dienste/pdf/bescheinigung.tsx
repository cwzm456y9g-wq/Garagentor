import { doorTypeLabels, inspectionTypeLabels, operationModeLabels } from '@garagentor/shared';
import { Text, View } from '@react-pdf/renderer';
import { Abschnitt, Datenblatt, Unterschrift } from './bausteine';
import { Brief, farben, mm, stile, type Firma, type InfoZeile } from './din5008';
import {
  bescheinigungsBefund,
  bescheinigungsSatz,
  type Befund,
  type BescheinigungsMangel,
} from './bescheinigung.werte';

/**
 * Prüfbescheinigung nach ASR A1.7 – die Ausfertigung für den Kunden.
 *
 * Sie beantwortet genau eine Frage: Ist die Anlage in Ordnung oder sind Mängel
 * vorhanden? Die einzelnen Prüfpunkte, Messwerte und Beobachtungen stehen
 * bewusst nicht darin. Das vollständige Protokoll bleibt beim Prüfbetrieb und
 * wird auf Wunsch herausgegeben – die Bescheinigung sagt das auch ausdrücklich,
 * damit niemand meint, dies sei bereits alles.
 *
 * Zwei Angaben bleiben trotz der Kürze darin, und zwar nicht aus Gewohnheit:
 *
 * Ein sicherheitsrelevanter Mangel wird beim Namen genannt, samt der Folge
 * (Anlage außer Betrieb nehmen). Wer die Anlage betreibt, trägt dafür die
 * Verantwortung; ihn erst auf Nachfrage zu informieren, wäre keine
 * Zurückhaltung, sondern ein Versäumnis.
 *
 * Der Termin der nächsten Prüfung steht darauf, weil die Bescheinigung sonst
 * ihren Zweck verfehlt: Sie wird abgeheftet und bei einer Begehung vorgelegt.
 */

/* Formatierung ---------------------------------------------------------- */

const datumsformat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const datum = (wert: Date | string | null | undefined): string =>
  wert ? datumsformat.format(new Date(wert)) : '–';

/* Daten ---------------------------------------------------------------- */

export interface BescheinigungsAnlage {
  doorNumber: string;
  location: string;
  type: string;
  operationMode: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  yearBuilt: number | null;
}

export interface BescheinigungsDaten {
  inspectionNumber: string;
  type: string;
  date: Date | string;
  inspectorName: string;
  result: string | null;
  nextDueDate: Date | string | null;
  signatureInspector: string | null;
  completedAt: Date | string | null;
  customerNumber: string | null;
  anlage: BescheinigungsAnlage;
  maengel: BescheinigungsMangel[];
}

export interface BescheinigungsOptionen {
  firma: Firma;
  empfaenger: string[];
}

/* Bausteine ------------------------------------------------------------- */

const FARBE: Record<Befund['ton'], string> = {
  gut: '#15803d',
  hinweis: '#b45309',
  ernst: '#b42318',
};

/**
 * Der Ergebniskasten. Er ist der eigentliche Inhalt des Blattes und deshalb
 * groß gesetzt – wer ihn liest, hat die Bescheinigung gelesen.
 */
function Ergebniskasten({ befund }: { befund: Befund }) {
  const farbe = FARBE[befund.ton];

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: farbe,
        paddingVertical: mm(4),
        paddingHorizontal: mm(4),
        marginTop: mm(2),
      }}
      wrap={false}
    >
      <Text style={[stile.klein, stile.leise]}>Ergebnis der Prüfung</Text>
      <Text style={[stile.fett, { fontSize: 16, color: farbe, marginTop: 2 }]}>
        {befund.ueberschrift}
      </Text>
      <Text style={{ fontSize: 9, marginTop: mm(2) }}>{befund.satz}</Text>
      {befund.warnung ? (
        <Text style={[stile.fett, { fontSize: 9, color: farbe, marginTop: mm(2) }]}>
          {befund.warnung}
        </Text>
      ) : null}
    </View>
  );
}

/* Bescheinigung --------------------------------------------------------- */

export function Pruefbescheinigung({
  daten,
  optionen,
}: {
  daten: BescheinigungsDaten;
  optionen: BescheinigungsOptionen;
}) {
  const anlage = daten.anlage;
  const befund = bescheinigungsBefund(daten.result, daten.maengel);

  const infoZeilen: InfoZeile[] = [
    { label: 'Bescheinigung-Nr.', wert: daten.inspectionNumber },
    { label: 'Prüfdatum', wert: datum(daten.date) },
    ...(daten.customerNumber ? [{ label: 'Kunden-Nr.', wert: daten.customerNumber }] : []),
    { label: 'Anlage', wert: anlage.doorNumber },
    { label: 'Prüfende Person', wert: daten.inspectorName },
  ];

  const ortUndDatum = [optionen.firma.city, datum(daten.completedAt ?? daten.date)]
    .filter(Boolean)
    .join(', ');

  return (
    <Brief
      firma={optionen.firma}
      empfaenger={optionen.empfaenger}
      betreff={`Prüfbescheinigung ${daten.inspectionNumber} – ${anlage.doorNumber}, ${anlage.location}`}
      infoZeilen={infoZeilen}
      fussHinweis={daten.inspectionNumber}
    >
      <Text style={[stile.klein, stile.leise]}>
        {inspectionTypeLabels[daten.type as keyof typeof inspectionTypeLabels] ?? daten.type} nach
        ASR A1.7 in Verbindung mit DIN EN 12453 und DIN EN 12604, durchgeführt durch eine
        sachkundige Person im Sinne der DGUV Information 208-022.
      </Text>

      <Ergebniskasten befund={befund} />

      <Abschnitt titel="Geprüfte Anlage">
        <Datenblatt
          eintraege={[
            ['Anlagen-Nr.', anlage.doorNumber],
            ['Einbauort', anlage.location],
            ['Bauart', doorTypeLabels[anlage.type as keyof typeof doorTypeLabels] ?? anlage.type],
            [
              'Betätigung',
              operationModeLabels[anlage.operationMode as keyof typeof operationModeLabels] ??
                anlage.operationMode,
            ],
            ['Hersteller', [anlage.manufacturer, anlage.model].filter(Boolean).join(' ') || '–'],
            ['Serien-Nr.', anlage.serialNumber ?? '–'],
            ['Baujahr', anlage.yearBuilt ? String(anlage.yearBuilt) : '–'],
            ['Nächste Prüfung', datum(daten.nextDueDate)],
          ]}
        />
      </Abschnitt>

      <Abschnitt titel="Bestätigung" zusammen>
        <Text style={[stile.klein, { marginBottom: mm(3) }]}>{bescheinigungsSatz(befund)}</Text>
        <View style={{ flexDirection: 'row' }} wrap={false}>
          <Unterschrift
            rolle="Prüfende Person"
            name={daten.inspectorName}
            signatur={daten.signatureInspector}
            ort={ortUndDatum}
          />
        </View>
      </Abschnitt>

      {/* Der Schlussblock bleibt zusammen und knapp: Die Bescheinigung soll auf
          ein Blatt passen. Ein zweites Blatt, auf dem nur der
          Aufbewahrungshinweis steht, sieht nach einem Fehler aus. */}
      <View
        style={{
          marginTop: mm(4),
          borderTopWidth: 0.5,
          borderTopColor: farben.linie,
          paddingTop: mm(2),
        }}
        wrap={false}
      >
        <Text style={[{ fontSize: 7 }, stile.leise]}>
          Das ausführliche Prüfprotokoll mit sämtlichen Einzelprüfpunkten, Messwerten und
          Feststellungen wird beim ausstellenden Betrieb geführt und Ihnen auf Wunsch ausgehändigt.
        </Text>
        <Text style={[{ fontSize: 6.5 }, stile.blass, { marginTop: 2 }]}>
          Aufbewahrung: Der Nachweis ist bis zur nächsten Prüfung, mindestens jedoch über die
          Nutzungsdauer der Anlage, aufzubewahren (ASR A1.7 Abs. 10).
        </Text>
      </View>
    </Brief>
  );
}
