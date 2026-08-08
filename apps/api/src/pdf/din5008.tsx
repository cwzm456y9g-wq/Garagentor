import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';

/**
 * Geschäftsbrief nach DIN 5008 Form A. Die Maße stehen in Millimeter, weil die
 * Norm so argumentiert; umgerechnet wird erst beim Zeichnen.
 *
 * Entscheidend ist die Lage des Anschriftfelds: nur an der Norm-Position
 * erscheint die Adresse im Fenster eines Standardkuverts. Die Faltmarken sitzen
 * so, dass zwei Falze das Blatt genau auf Fensterhöhe legen.
 */

/** Millimeter in Punkt (72 dpi). */
export const mm = (value: number): number => value * 2.834645669;

export const MASSE = {
  seitenrandLinks: 25,
  seitenrandRechts: 20,
  anschriftOben: 45,
  anschriftBreite: 85,
  anschriftHoehe: 40,
  /** Zone für Rücksendeangabe über der Anschrift. */
  ruecksendeHoehe: 5,
  betreffOben: 98.46,
  faltmarkeEins: 87,
  faltmarkeZwei: 192,
  lochmarke: 148.5,
  fussOben: 272,
} as const;

export const farben = {
  ink: '#12202f',
  soft: '#4d5f72',
  faint: '#7f92a5',
  linie: '#c8d3de',
  akzent: '#30567b',
} as const;

export const stile = StyleSheet.create({
  seite: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: farben.ink,
    paddingTop: mm(MASSE.anschriftOben),
    paddingLeft: mm(MASSE.seitenrandLinks),
    paddingRight: mm(MASSE.seitenrandRechts),
    paddingBottom: mm(297 - MASSE.fussOben + 6),
    lineHeight: 1.4,
  },
  fett: { fontFamily: 'Helvetica-Bold' },
  klein: { fontSize: 8 },
  leise: { color: farben.soft },
  blass: { color: farben.faint },
  rechts: { textAlign: 'right' },
});

/**
 * Absolut platzierter Block, gemessen vom Blattrand.
 *
 * `nurErsteSeite` ist für Anschriftfeld und Informationsblock gedacht: nach
 * DIN 5008 stehen sie ausschließlich auf dem ersten Blatt. Wiederholt man sie,
 * laufen sie auf den Folgeseiten in den Fließtext hinein.
 */
function Absolut({
  oben,
  links,
  breite,
  nurErsteSeite = false,
  children,
}: {
  oben: number;
  links: number;
  breite?: number;
  nurErsteSeite?: boolean;
  children: ReactNode;
}) {
  const stil = {
    position: 'absolute' as const,
    top: mm(oben),
    left: mm(links),
    ...(breite === undefined ? {} : { width: mm(breite) }),
  };

  // `fixed` wiederholt einen Block auf jeder Seite. Anschriftfeld und
  // Informationsblock gehören nach DIN 5008 nur auf das erste Blatt – ohne
  // `fixed` zeichnet react-pdf sie genau dort, wo sie im Fluss stehen.
  return (
    <View style={stil} fixed={!nurErsteSeite}>
      {children}
    </View>
  );
}

/** Falt- und Lochmarken am linken Rand. */
function Marken() {
  const strich = (oben: number, laenge: number) => (
    <View
      key={oben}
      style={{
        position: 'absolute',
        top: mm(oben),
        left: 0,
        width: mm(laenge),
        borderTopWidth: 0.5,
        borderTopColor: farben.linie,
      }}
      fixed
    />
  );
  return (
    <>
      {strich(MASSE.faltmarkeEins, 4)}
      {strich(MASSE.faltmarkeZwei, 4)}
      {strich(MASSE.lochmarke, 6)}
    </>
  );
}

export interface Firma {
  name?: string;
  street?: string;
  zip?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxNumber?: string;
  vatId?: string;
  managingDirector?: string;
  registerCourt?: string;
  registerNumber?: string;
  bankName?: string;
  iban?: string;
  bic?: string;
  logo?: string;
}

/** Eine Zeile im Informationsblock rechts neben der Anschrift. */
export interface InfoZeile {
  label: string;
  wert: string;
}

export interface BriefProps {
  firma: Firma;
  /** Anschrift des Empfängers, Zeile für Zeile. */
  empfaenger: string[];
  betreff: string;
  infoZeilen: InfoZeile[];
  /** Erscheint in der Fußzeile links, z. B. die Belegnummer. */
  fussHinweis?: string;
  children: ReactNode;
}

/**
 * Rahmen eines Belegs: Briefkopf, Anschriftfeld an Norm-Position,
 * Informationsblock, Betreff, Fußzeile und Seitenzählung.
 */
export function Brief({
  firma,
  empfaenger,
  betreff,
  infoZeilen,
  fussHinweis,
  children,
}: BriefProps) {
  const absender = [firma.name, firma.street, [firma.zip, firma.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' · ');

  return (
    <Document
      title={betreff}
      author={firma.name ?? 'Garagentor'}
      creator="Garagentor"
      producer="Garagentor"
    >
      <Page size="A4" style={stile.seite} wrap>
        <Marken />

        {/* Briefkopf: Logo rechts, damit die Rücksendeangabe frei bleibt. */}
        <Absolut oben={12} links={MASSE.seitenrandLinks} breite={210 - 25 - 20}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={[stile.fett, { fontSize: 13, color: farben.akzent }]}>
                {firma.name ?? ''}
              </Text>
              {firma.street ? <Text style={[stile.klein, stile.leise]}>{firma.street}</Text> : null}
              <Text style={[stile.klein, stile.leise]}>
                {[firma.zip, firma.city].filter(Boolean).join(' ')}
              </Text>
            </View>
            {firma.logo ? (
              <Image src={firma.logo} style={{ maxWidth: mm(45), maxHeight: mm(20) }} />
            ) : null}
          </View>
        </Absolut>

        {/* Anschriftfeld. Die Rücksendeangabe steht klein darüber, wie üblich. */}
        <Absolut
          oben={MASSE.anschriftOben}
          links={MASSE.seitenrandLinks}
          breite={MASSE.anschriftBreite}
          nurErsteSeite
        >
          <Text style={[{ fontSize: 6.5 }, stile.blass]}>{absender}</Text>
          <View style={{ marginTop: mm(2) }}>
            {empfaenger.map((zeile, index) => (
              <Text key={`${zeile}-${index}`}>{zeile}</Text>
            ))}
          </View>
        </Absolut>

        {/* Informationsblock rechts: Nummern und Daten des Belegs. */}
        <Absolut oben={MASSE.anschriftOben} links={125} breite={65} nurErsteSeite>
          {infoZeilen.map((zeile) => (
            <View key={zeile.label} style={{ flexDirection: 'row', marginBottom: 1 }}>
              <Text style={[stile.klein, stile.leise, { width: mm(30) }]}>{zeile.label}</Text>
              <Text style={[stile.klein, stile.fett, { flex: 1 }]}>{zeile.wert}</Text>
            </View>
          ))}
        </Absolut>

        {/* Betreff an Norm-Position, ohne das Wort „Betreff“. Der Abstand
            schiebt den Fließtext unter das Anschriftfeld; auf den Folgeseiten
            beginnt der Text direkt unter dem Seitenrand. */}
        <View style={{ marginTop: mm(MASSE.betreffOben - MASSE.anschriftOben) }}>
          <Text style={[stile.fett, { fontSize: 11 }]}>{betreff}</Text>
        </View>

        <View style={{ marginTop: mm(4) }}>{children}</View>

        {/* Fußzeile: Pflichtangaben und Bankverbindung, auf jeder Seite. */}
        <View
          style={{
            position: 'absolute',
            top: mm(MASSE.fussOben),
            left: mm(MASSE.seitenrandLinks),
            width: mm(210 - MASSE.seitenrandLinks - MASSE.seitenrandRechts),
            borderTopWidth: 0.5,
            borderTopColor: farben.linie,
            paddingTop: mm(2),
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
          fixed
        >
          <View style={{ width: '32%' }}>
            <Text style={[{ fontSize: 6.5 }, stile.blass]}>{firma.name ?? ''}</Text>
            {firma.street ? (
              <Text style={[{ fontSize: 6.5 }, stile.blass]}>{firma.street}</Text>
            ) : null}
            <Text style={[{ fontSize: 6.5 }, stile.blass]}>
              {[firma.zip, firma.city].filter(Boolean).join(' ')}
            </Text>
            {firma.phone ? (
              <Text style={[{ fontSize: 6.5 }, stile.blass]}>Telefon {firma.phone}</Text>
            ) : null}
            {firma.email ? (
              <Text style={[{ fontSize: 6.5 }, stile.blass]}>{firma.email}</Text>
            ) : null}
          </View>

          <View style={{ width: '32%' }}>
            {firma.managingDirector ? (
              <Text style={[{ fontSize: 6.5 }, stile.blass]}>
                Geschäftsführung: {firma.managingDirector}
              </Text>
            ) : null}
            {firma.registerCourt || firma.registerNumber ? (
              <Text style={[{ fontSize: 6.5 }, stile.blass]}>
                {[firma.registerCourt, firma.registerNumber].filter(Boolean).join(' ')}
              </Text>
            ) : null}
            {firma.taxNumber ? (
              <Text style={[{ fontSize: 6.5 }, stile.blass]}>Steuernummer {firma.taxNumber}</Text>
            ) : null}
            {firma.vatId ? (
              <Text style={[{ fontSize: 6.5 }, stile.blass]}>USt-IdNr. {firma.vatId}</Text>
            ) : null}
          </View>

          <View style={{ width: '32%' }}>
            {firma.bankName ? (
              <Text style={[{ fontSize: 6.5 }, stile.blass]}>{firma.bankName}</Text>
            ) : null}
            {firma.iban ? (
              <Text style={[{ fontSize: 6.5 }, stile.blass]}>IBAN {firma.iban}</Text>
            ) : null}
            {firma.bic ? (
              <Text style={[{ fontSize: 6.5 }, stile.blass]}>BIC {firma.bic}</Text>
            ) : null}
            <Text
              style={[{ fontSize: 6.5 }, stile.blass]}
              render={({ pageNumber, totalPages }) =>
                `${fussHinweis ? `${fussHinweis} · ` : ''}Seite ${pageNumber} von ${totalPages}`
              }
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
