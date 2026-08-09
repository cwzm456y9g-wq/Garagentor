import {
  checkResultLabels,
  defectSeverityLabels,
  doorTypeLabels,
  inspectionTypeLabels,
  operationModeLabels,
} from '@garagentor/shared';
import { Text, View } from '@react-pdf/renderer';
import { Abschnitt, Datenblatt, Fotobogen, Unterschrift, type Foto } from './bausteine';
import { Brief, farben, mm, stile, type Firma, type InfoZeile } from './din5008';
import { ergebnisText, istBeanstandet, messwertText } from './protokoll.werte';

/**
 * Prüfprotokoll nach ASR A1.7 für kraftbetätigte Fenster, Türen und Tore.
 *
 * Das Protokoll ist ein Nachweisdokument: es muss über die Nutzungsdauer der
 * Anlage aufbewahrt werden und im Schadensfall belegen, was wann von wem mit
 * welchem Ergebnis geprüft wurde. Deshalb steht jeder Prüfpunkt einzeln im
 * Ausdruck – auch die unauffälligen – und Messwerte erscheinen zusammen mit dem
 * Grenzwert, gegen den gemessen wurde.
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

export interface ProtokollPruefpunkt {
  position: number;
  key: string;
  group: string;
  label: string;
  reference: string | null;
  result: string;
  measuredValue: number | null;
  unit: string | null;
  limitValue: number | null;
  comment: string | null;
}

export interface ProtokollMangel {
  severity: string;
  title: string;
  description: string | null;
  checkKey: string | null;
  dueDate: Date | string | null;
}

export interface ProtokollAnlage {
  doorNumber: string;
  location: string;
  type: string;
  operationMode: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  yearBuilt: number | null;
  driveManufacturer: string | null;
  driveModel: string | null;
}

export interface ProtokollDaten {
  inspectionNumber: string;
  type: string;
  date: Date | string;
  inspectorName: string;
  result: string | null;
  nextDueDate: Date | string | null;
  summary: string | null;
  recommendation: string | null;
  signatureInspector: string | null;
  signatureCustomer: string | null;
  signedByName: string | null;
  completedAt: Date | string | null;
  customerNumber: string | null;
  anlage: ProtokollAnlage;
  pruefpunkte: ProtokollPruefpunkt[];
  maengel: ProtokollMangel[];
  fotos: Foto[];
}

export interface ProtokollOptionen {
  firma: Firma;
  empfaenger: string[];
}

/* Bausteine ------------------------------------------------------------- */

/** Ergebniskasten unter dem Betreff. */
function Ergebnis({ daten }: { daten: ProtokollDaten }) {
  const beanstandet = istBeanstandet(daten.result);
  const rahmen = beanstandet ? '#b42318' : farben.akzent;

  return (
    <View
      style={{
        borderWidth: 0.8,
        borderColor: rahmen,
        paddingVertical: mm(2),
        paddingHorizontal: mm(3),
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}
      wrap={false}
    >
      <View style={{ flex: 1, paddingRight: mm(3) }}>
        <Text style={[stile.klein, stile.leise]}>Prüfergebnis</Text>
        <Text style={[stile.fett, { fontSize: 12, color: rahmen }]}>
          {ergebnisText(daten.result)}
        </Text>
        {daten.summary ? (
          <Text style={[stile.klein, { marginTop: 2 }]}>{daten.summary}</Text>
        ) : null}
      </View>
      <View style={{ width: mm(45) }}>
        <Text style={[stile.klein, stile.leise]}>Nächste Prüfung</Text>
        <Text style={stile.fett}>{datum(daten.nextDueDate)}</Text>
        <Text style={[stile.klein, stile.leise, { marginTop: 2 }]}>Beanstandungen</Text>
        <Text style={stile.fett}>{daten.maengel.length}</Text>
      </View>
    </View>
  );
}

const SPALTEN = { pos: 8, ergebnis: 24, messwert: 30 } as const;

function PruefpunktKopf() {
  return (
    <View
      style={{
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: farben.linie,
        paddingBottom: 2,
        marginBottom: 1,
      }}
      fixed
    >
      <Text style={[stile.klein, stile.fett, { width: mm(SPALTEN.pos) }]}>Nr.</Text>
      <Text style={[stile.klein, stile.fett, { flex: 1 }]}>Prüfpunkt</Text>
      <Text style={[stile.klein, stile.fett, stile.rechts, { width: mm(SPALTEN.messwert) }]}>
        Messwert
      </Text>
      <Text style={[stile.klein, stile.fett, stile.rechts, { width: mm(SPALTEN.ergebnis) }]}>
        Ergebnis
      </Text>
    </View>
  );
}

function Pruefpunkt({ punkt }: { punkt: ProtokollPruefpunkt }) {
  const mangel = punkt.result === 'MANGEL';

  return (
    // wrap={false} hält Prüfpunkt und Ergebnis zusammen – getrennt wäre die
    // Zeile im Nachweis nicht mehr eindeutig zuzuordnen.
    <View
      style={{
        flexDirection: 'row',
        paddingVertical: 1.8,
        borderBottomWidth: 0.3,
        borderBottomColor: farben.linie,
      }}
      wrap={false}
    >
      <Text style={[stile.klein, stile.leise, { width: mm(SPALTEN.pos) }]}>{punkt.position}</Text>
      <View style={{ flex: 1, paddingRight: 4 }}>
        <Text style={stile.klein}>{punkt.label}</Text>
        {punkt.reference ? (
          <Text style={[{ fontSize: 6.5 }, stile.blass]}>{punkt.reference}</Text>
        ) : null}
        {punkt.comment ? (
          <Text style={[{ fontSize: 7 }, mangel ? { color: '#b42318' } : stile.leise]}>
            {punkt.comment}
          </Text>
        ) : null}
      </View>
      <Text style={[stile.klein, stile.rechts, { width: mm(SPALTEN.messwert) }]}>
        {messwertText(punkt.measuredValue, punkt.unit, punkt.limitValue)}
      </Text>
      <Text
        style={[
          stile.klein,
          stile.rechts,
          stile.fett,
          { width: mm(SPALTEN.ergebnis) },
          mangel ? { color: '#b42318' } : {},
        ]}
      >
        {checkResultLabels[punkt.result as keyof typeof checkResultLabels] ?? punkt.result}
      </Text>
    </View>
  );
}

/* Protokoll ------------------------------------------------------------- */

export function Pruefprotokoll({
  daten,
  optionen,
}: {
  daten: ProtokollDaten;
  optionen: ProtokollOptionen;
}) {
  const anlage = daten.anlage;

  const infoZeilen: InfoZeile[] = [
    { label: 'Protokoll-Nr.', wert: daten.inspectionNumber },
    { label: 'Prüfdatum', wert: datum(daten.date) },
    ...(daten.customerNumber ? [{ label: 'Kunden-Nr.', wert: daten.customerNumber }] : []),
    { label: 'Anlage', wert: anlage.doorNumber },
    { label: 'Prüfende Person', wert: daten.inspectorName },
  ];

  // Die Prüfpunkte behalten die Reihenfolge des Katalogs; die Gruppen ergeben
  // sich daraus, ohne die Nummerierung zu stören.
  const gruppen: Array<[string, ProtokollPruefpunkt[]]> = [];
  for (const punkt of daten.pruefpunkte) {
    const letzte = gruppen.at(-1);
    if (letzte && letzte[0] === punkt.group) letzte[1].push(punkt);
    else gruppen.push([punkt.group, [punkt]]);
  }

  const ortUndDatum = [optionen.firma.city, datum(daten.completedAt ?? daten.date)]
    .filter(Boolean)
    .join(', ');

  return (
    <Brief
      firma={optionen.firma}
      empfaenger={optionen.empfaenger}
      betreff={`Prüfprotokoll ${daten.inspectionNumber} – ${anlage.doorNumber}, ${anlage.location}`}
      infoZeilen={infoZeilen}
      fussHinweis={daten.inspectionNumber}
    >
      <Text style={[stile.klein, stile.leise, { marginBottom: mm(3) }]}>
        {inspectionTypeLabels[daten.type as keyof typeof inspectionTypeLabels] ?? daten.type} nach
        ASR A1.7 in Verbindung mit DIN EN 12453 und DIN EN 12604. Die Prüfung erfolgte durch eine
        sachkundige Person im Sinne der DGUV Information 208-022.
      </Text>

      <Ergebnis daten={daten} />

      <Abschnitt titel="Anlage">
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
            [
              'Antrieb',
              [anlage.driveManufacturer, anlage.driveModel].filter(Boolean).join(' ') || '–',
            ],
          ]}
        />
      </Abschnitt>

      <Abschnitt titel={`Prüfpunkte (${daten.pruefpunkte.length})`}>
        <PruefpunktKopf />
        {gruppen.map(([gruppe, punkte]) => (
          <View key={gruppe}>
            <Text
              style={[
                stile.klein,
                stile.fett,
                stile.leise,
                { marginTop: 4, marginBottom: 1 },
                { color: farben.akzent },
              ]}
            >
              {gruppe}
            </Text>
            {punkte.map((punkt) => (
              <Pruefpunkt key={punkt.key} punkt={punkt} />
            ))}
          </View>
        ))}
      </Abschnitt>

      {daten.maengel.length > 0 ? (
        <Abschnitt titel={`Festgestellte Mängel (${daten.maengel.length})`}>
          {daten.maengel.map((mangel, index) => (
            <View
              key={`${mangel.checkKey ?? 'mangel'}-${index}`}
              style={{
                flexDirection: 'row',
                paddingVertical: 2,
                borderBottomWidth: 0.3,
                borderBottomColor: farben.linie,
              }}
              wrap={false}
            >
              <Text style={[stile.klein, stile.fett, { width: mm(28), color: '#b42318' }]}>
                {defectSeverityLabels[mangel.severity as keyof typeof defectSeverityLabels] ??
                  mangel.severity}
              </Text>
              <View style={{ flex: 1, paddingRight: 4 }}>
                <Text style={stile.klein}>{mangel.title}</Text>
                {mangel.description ? (
                  <Text style={[{ fontSize: 7 }, stile.leise]}>{mangel.description}</Text>
                ) : null}
              </View>
              <Text style={[stile.klein, stile.rechts, { width: mm(28) }]}>
                {mangel.severity === 'GEFAHR_IM_VERZUG' ? 'sofort' : datum(mangel.dueDate)}
              </Text>
            </View>
          ))}
          <Text style={[{ fontSize: 7 }, stile.leise, { marginTop: 2 }]}>
            Die angegebene Frist bezeichnet den Termin, bis zu dem der Mangel zu beheben ist.
          </Text>
        </Abschnitt>
      ) : null}

      {daten.recommendation ? (
        <Abschnitt titel="Empfehlung">
          <Text style={stile.klein}>{daten.recommendation}</Text>
        </Abschnitt>
      ) : null}

      <Fotobogen
        fotos={daten.fotos}
        beschriften={(ref) => {
          if (!ref) return 'Zur Anlage';
          const punkt = daten.pruefpunkte.find((p) => p.key === ref);
          return punkt ? `Nr. ${punkt.position} – ${punkt.label}` : ref;
        }}
      />

      {/* Überschrift, Hinweis und Unterschriften gehören zusammen: eine
          Unterschriftenzeile ohne den Text darüber ist als Nachweis wertlos. */}
      <Abschnitt titel="Bestätigung" zusammen>
        <Text style={[{ fontSize: 7 }, stile.leise, { marginBottom: mm(2) }]}>
          {daten.result === 'NICHT_BESTANDEN'
            ? 'Die Anlage weist einen sicherheitsrelevanten Mangel auf und ist bis zur ' +
              'Instandsetzung außer Betrieb zu nehmen. Der Betreiber wurde darauf hingewiesen.'
            : 'Die Prüfung wurde im vorstehenden Umfang durchgeführt. Das Ergebnis bezieht ' +
              'sich auf den Zustand der Anlage am Prüftag.'}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} wrap={false}>
          <Unterschrift
            rolle="Prüfende Person"
            name={daten.inspectorName}
            signatur={daten.signatureInspector}
            ort={ortUndDatum}
          />
          <Unterschrift
            rolle="Betreiber bzw. Beauftragter"
            name={daten.signedByName ?? ''}
            signatur={daten.signatureCustomer}
            ort={ortUndDatum}
          />
        </View>
      </Abschnitt>

      <Text style={[{ fontSize: 6.5 }, stile.blass, { marginTop: mm(4) }]}>
        Aufbewahrung: Das Protokoll ist bis zur nächsten Prüfung, mindestens jedoch über die
        Nutzungsdauer der Anlage, aufzubewahren (ASR A1.7 Abs. 10).
      </Text>
    </Brief>
  );
}
