import { Image, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { farben, mm, stile } from './din5008';

/**
 * Bausteine, die sich Prüfprotokoll und Servicebericht teilen: Abschnitte,
 * Datenblätter, Fotobogen und Unterschriftenfelder. Beide Belege sind
 * Nachweisdokumente vom selben Einsatz und sollen deshalb gleich aussehen.
 */

/** Abschnitt mit Überschrift und Trennlinie. */
export function Abschnitt({
  titel,
  zusammen = false,
  children,
}: {
  titel: string;
  /** Hält Überschrift und Inhalt auf einem Blatt. */
  zusammen?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={{ marginTop: mm(5) }} wrap={!zusammen}>
      <Text
        style={[
          stile.fett,
          {
            fontSize: 10,
            borderBottomWidth: 0.7,
            borderBottomColor: farben.ink,
            paddingBottom: 2,
            marginBottom: 3,
          },
        ]}
      >
        {titel}
      </Text>
      {children}
    </View>
  );
}

/** Zweispaltige Aufstellung aus Beschriftung und Wert. */
export function Datenblatt({ eintraege }: { eintraege: Array<[string, string]> }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {eintraege.map(([label, wert]) => (
        <View key={label} style={{ flexDirection: 'row', width: '50%', paddingVertical: 0.8 }}>
          <Text style={[stile.klein, stile.leise, { width: mm(30) }]}>{label}</Text>
          <Text style={[stile.klein, { flex: 1 }]}>{wert}</Text>
        </View>
      ))}
    </View>
  );
}

/** Ein Foto aus der Dokumentenablage, bereits als Data-URL. */
export interface Foto {
  /** Feinere Zuordnung innerhalb des Belegs, etwa ein Prüfpunkt. */
  entityRef: string | null;
  title: string | null;
  data: string;
}

/**
 * Fotos in zwei Spalten. `beschriften` löst den Bezug in Klartext auf – im
 * Prüfprotokoll ist das der Prüfpunkt, im Servicebericht die Aufnahme selbst.
 */
export function Fotobogen({
  fotos,
  titel = 'Fotodokumentation',
  beschriften,
}: {
  fotos: Foto[];
  titel?: string;
  beschriften: (ref: string | null) => string;
}) {
  if (fotos.length === 0) return null;

  return (
    <Abschnitt titel={titel}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {fotos.map((foto, index) => (
          <View
            key={`${foto.entityRef ?? 'beleg'}-${index}`}
            style={{ width: '50%', paddingRight: mm(3), paddingBottom: mm(3) }}
            wrap={false}
          >
            <Image src={foto.data} style={{ height: mm(45), objectFit: 'contain' }} />
            <Text style={[{ fontSize: 6.5 }, stile.blass, { marginTop: 1 }]}>
              {beschriften(foto.entityRef)}
            </Text>
            {foto.title ? <Text style={[{ fontSize: 6.5 }, stile.blass]}>{foto.title}</Text> : null}
          </View>
        ))}
      </View>
    </Abschnitt>
  );
}

/** Unterschriftenfeld: die Signatur wird über die Linie gesetzt. */
export function Unterschrift({
  rolle,
  name,
  signatur,
  ort,
}: {
  rolle: string;
  name: string;
  signatur: string | null;
  ort: string;
}) {
  return (
    <View style={{ width: '47%' }}>
      <View style={{ height: mm(18), justifyContent: 'flex-end' }}>
        {signatur ? (
          <Image src={signatur} style={{ height: mm(16), objectFit: 'contain' }} />
        ) : null}
      </View>
      <View style={{ borderTopWidth: 0.5, borderTopColor: farben.ink, paddingTop: 2 }}>
        <Text style={[stile.klein, stile.fett]}>{name || '–'}</Text>
        <Text style={[{ fontSize: 6.5 }, stile.blass]}>{rolle}</Text>
        <Text style={[{ fontSize: 6.5 }, stile.blass]}>{ort}</Text>
      </View>
    </View>
  );
}
