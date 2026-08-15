'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, Button, Card, Field, Input, PageHeader, Select, Table } from '@/components/ui';
import {
  auslegen,
  baulaenge,
  beurteilen,
  biegespannung,
  drahtAusMessung,
  federrate,
  GUETEN,
  hubUmdrehungen,
  mittelAusAussen,
  mittelAusInnen,
  moment,
  tragfaehigkeit,
  wickelverhaeltnis,
  windungenAusLaenge,
  zugfestigkeit,
  type Feder,
  type Guete,
  type Ton,
  type Vorschlag,
} from '@/lib/federn';

/**
 * Federrechner für Torsionsfedern.
 *
 * Steht bewußt ohne Datenbank und ohne Schnittstelle da: Wer mit einer
 * gebrochenen Feder vor einem Tor steht, will rechnen, nicht anlegen. Die
 * Seite läuft vollständig im Browser – und damit auch dann, wenn das Netz in
 * der Halle schwach ist.
 *
 * Zwei Betriebsarten, weil es zwei verschiedene Aufgaben sind: die gebrochene
 * Feder bestimmen, oder für ein Tor eine neue auslegen.
 */

type Betriebsart = 'ausmessen' | 'auslegen';

/* Zahlen aus Feldern lesen und wieder hinschreiben ---------------------- */

/** Nimmt Komma wie Punkt – auf der Baustelle tippt niemand um. */
function zahl(wert: string): number | null {
  const bereinigt = wert.replace(',', '.').trim();
  if (!bereinigt) return null;
  const gelesen = Number(bereinigt);
  return Number.isFinite(gelesen) && gelesen > 0 ? gelesen : null;
}

const de = (wert: number, stellen = 1) =>
  wert.toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });

const TON_FARBE: Record<Ton, 'success' | 'warning' | 'danger'> = {
  gut: 'success',
  knapp: 'warning',
  kritisch: 'danger',
};

const TON_WORT: Record<Ton, string> = {
  gut: 'reichlich',
  knapp: 'üblich',
  kritisch: 'zu klein',
};

export default function FedernPage() {
  const [art, setArt] = useState<Betriebsart>('ausmessen');

  return (
    <>
      <PageHeader
        title="Federrechner"
        subtitle="Torsionsfedern ausmessen und auslegen"
        actions={
          <div className="flex gap-2">
            <Button
              variant={art === 'ausmessen' ? 'primary' : 'secondary'}
              onClick={() => setArt('ausmessen')}
            >
              Feder ausmessen
            </Button>
            <Button
              variant={art === 'auslegen' ? 'primary' : 'secondary'}
              onClick={() => setArt('auslegen')}
            >
              Feder auslegen
            </Button>
          </div>
        }
      />

      {/*
        Beide Rechner lesen Vorgaben aus der Adresse, damit der Weg von einer
        Toranlage hierher Gewicht und Höhe mitbringt. `useSearchParams` zwingt
        zu einer Suspense-Grenze – ohne sie bräche der Bau der Seite ab.
      */}
      <Suspense fallback={<div className="text-sm text-slate-500">wird geladen …</div>}>
        {art === 'ausmessen' ? <Ausmessen /> : <Auslegen />}
      </Suspense>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <MesshinweiseKarte />
        <GrundlagenKarte />
      </div>
    </>
  );
}

/* Feder ausmessen ------------------------------------------------------- */

/**
 * Der häufigere Fall: Die Feder ist gebrochen, das Tor hing im Gleichgewicht.
 * Gerechnet wird nicht, um zu entscheiden, sondern um zu bestätigen – trägt
 * das, was der Lieferant anbietet, dasselbe Tor?
 */
function Ausmessen() {
  const parameter = useSearchParams();

  // Vorgabe ist eine wirklich gebaute Feder: 6 mm Draht, 67 mm innen, 774 mm
  // lang. Sie trägt an einer 46-mm-Trommel ein 2125er Tor von rund 100 kg und
  // liegt dabei unter der zulässigen Spannung – ein Bild, an dem man sieht,
  // wie eine tragfähige Auslegung aussieht.
  const [draht, setDraht] = useState('6');
  const [bezug, setBezug] = useState<'innen' | 'aussen'>('innen');
  const [durchmesser, setDurchmesser] = useState('67');
  const [ueber, setUeber] = useState<'windungen' | 'laenge'>('windungen');
  const [windungen, setWindungen] = useState('129');
  const [laenge, setLaenge] = useState('774');

  // Meßhilfe für die Drahtstärke.
  const [messWindungen, setMessWindungen] = useState('20');
  const [messLaenge, setMessLaenge] = useState('');

  const [hoehe, setHoehe] = useState(parameter.get('hoehe') ?? '2125');
  const [trommel, setTrommel] = useState('46');
  const [anzahl, setAnzahl] = useState('2');
  const [reserve, setReserve] = useState('0,75');

  const [guete, setGuete] = useState<Guete>('DH');
  const [festigkeit, setFestigkeit] = useState('');

  const ergebnis = useMemo(() => {
    const d = zahl(draht);
    const dm = zahl(durchmesser);
    const n = ueber === 'windungen' ? zahl(windungen) : null;
    const l = ueber === 'laenge' ? zahl(laenge) : null;
    const h = zahl(hoehe);
    const r = zahl(trommel);
    const anz = zahl(anzahl);
    const res = zahl(reserve) ?? 0;

    if (!d || !dm || !h || !r || !anz) return null;

    const mittelMm = bezug === 'innen' ? mittelAusInnen(dm, d) : mittelAusAussen(dm, d);
    if (mittelMm <= d) return null;

    const anzahlWindungen = n ?? (l ? windungenAusLaenge(l, d) : null);
    if (!anzahlWindungen) return null;

    const feder: Feder = { drahtMm: d, mittelMm, windungen: anzahlWindungen };
    const umdrehungen = hubUmdrehungen(h, r) + res;
    const spannung = biegespannung(feder, umdrehungen);
    const rm = zahl(festigkeit) ?? zugfestigkeit(d, guete);

    return {
      feder,
      umdrehungen,
      rate: federrate(feder),
      momentNm: moment(feder, umdrehungen),
      traegtKg: tragfaehigkeit(feder, umdrehungen, r, anz),
      laengeMm: baulaenge(feder),
      w: wickelverhaeltnis(feder),
      spannung,
      rm,
      urteil: beurteilen(spannung.korrigiert, rm),
    };
  }, [
    draht,
    bezug,
    durchmesser,
    ueber,
    windungen,
    laenge,
    hoehe,
    trommel,
    anzahl,
    reserve,
    guete,
    festigkeit,
  ]);

  const richtwert = useMemo(() => {
    const d = zahl(draht);
    return d ? zugfestigkeit(d, guete) : null;
  }, [draht, guete]);

  return (
    <>
      {/*
        Auf dem Telefon steht das Ergebnis sonst unter dem ganzen Formular –
        also genau dort, wo es beim Tippen niemand sieht. Wer draußen am Tor
        eine Zahl ändert, will sofort wissen, was sie bewirkt.
      */}
      {ergebnis && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-600">
                trägt bei {de(ergebnis.umdrehungen, 2)} Umdrehungen
              </p>
              <p className="text-xl font-bold tabular-nums text-slate-900">
                {de(ergebnis.traegtKg, 0)} kg
              </p>
            </div>
            <Badge tone={TON_FARBE[ergebnis.urteil.ton]}>
              {de(ergebnis.urteil.ausnutzung, 0)} %
            </Badge>
          </div>
        </div>
      )}

      <div className="grid gap-6 pb-24 lg:grid-cols-[1fr_1fr] lg:pb-0">
        <div className="space-y-6">
          <Card title="Die Feder">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Drahtstärke"
                  htmlFor="draht"
                  hint="in mm – der empfindlichste Wert überhaupt"
                >
                  <Input
                    id="draht"
                    inputMode="decimal"
                    value={draht}
                    onChange={(e) => setDraht(e.target.value)}
                  />
                </Field>

                <Field label="Durchmesser" htmlFor="durchmesser" hint="in mm">
                  <div className="flex gap-2">
                    <Select
                      aria-label="Bezug des Durchmessers"
                      className="w-28"
                      value={bezug}
                      onChange={(e) => setBezug(e.target.value as 'innen' | 'aussen')}
                    >
                      <option value="innen">innen</option>
                      <option value="aussen">außen</option>
                    </Select>
                    <Input
                      id="durchmesser"
                      inputMode="decimal"
                      value={durchmesser}
                      onChange={(e) => setDurchmesser(e.target.value)}
                    />
                  </div>
                </Field>
              </div>

              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-medium text-slate-700">
                  Drahtstärke aus einer Sammelmessung
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Windungen" htmlFor="mess-n" className="w-28">
                    <Input
                      id="mess-n"
                      inputMode="numeric"
                      value={messWindungen}
                      onChange={(e) => setMessWindungen(e.target.value)}
                    />
                  </Field>
                  <Field label="gemessen (mm)" htmlFor="mess-l" className="w-36">
                    <Input
                      id="mess-l"
                      inputMode="decimal"
                      value={messLaenge}
                      onChange={(e) => setMessLaenge(e.target.value)}
                    />
                  </Field>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mb-0.5"
                    disabled={!zahl(messWindungen) || !zahl(messLaenge)}
                    onClick={() => {
                      const n = zahl(messWindungen);
                      const l = zahl(messLaenge);
                      if (n && l) setDraht(de(drahtAusMessung(l, n), 2));
                    }}
                  >
                    Übernehmen
                  </Button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Eine einzelne Windung zu messen ist zu ungenau: Die Drahtstärke geht mit der
                  vierten Potenz ein, ein halber Millimeter Irrtum bei 5 mm verschiebt die Federrate
                  um 45 %.
                </p>
              </div>

              <Field label="Länge der Feder" htmlFor="windungen">
                <div className="flex gap-2">
                  <Select
                    aria-label="Angabe der Federlänge"
                    className="w-36"
                    value={ueber}
                    onChange={(e) => setUeber(e.target.value as 'windungen' | 'laenge')}
                  >
                    <option value="windungen">Windungen</option>
                    <option value="laenge">Baulänge mm</option>
                  </Select>
                  {ueber === 'windungen' ? (
                    <Input
                      id="windungen"
                      inputMode="decimal"
                      value={windungen}
                      onChange={(e) => setWindungen(e.target.value)}
                    />
                  ) : (
                    <Input
                      id="windungen"
                      inputMode="decimal"
                      value={laenge}
                      onChange={(e) => setLaenge(e.target.value)}
                    />
                  )}
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Drahtgüte" htmlFor="guete">
                  <Select
                    id="guete"
                    value={guete}
                    onChange={(e) => {
                      setGuete(e.target.value as Guete);
                      setFestigkeit('');
                    }}
                  >
                    {Object.entries(GUETEN).map(([schluessel, name]) => (
                      <option key={schluessel} value={schluessel}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Zugfestigkeit"
                  htmlFor="festigkeit"
                  hint={
                    richtwert
                      ? `Richtwert ${richtwert} N/mm² – maßgeblich ist das Zeugnis`
                      : 'in N/mm²'
                  }
                >
                  <Input
                    id="festigkeit"
                    inputMode="decimal"
                    placeholder={richtwert ? String(richtwert) : ''}
                    value={festigkeit}
                    onChange={(e) => setFestigkeit(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Die Anlage">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Torhöhe" htmlFor="hoehe" hint="in mm">
                <Input
                  id="hoehe"
                  inputMode="decimal"
                  value={hoehe}
                  onChange={(e) => setHoehe(e.target.value)}
                />
              </Field>
              <Field label="Trommelradius" htmlFor="trommel" hint="in mm, am Seilgrund gemessen">
                <Input
                  id="trommel"
                  inputMode="decimal"
                  value={trommel}
                  onChange={(e) => setTrommel(e.target.value)}
                />
              </Field>
              <Field label="Anzahl Federn" htmlFor="anzahl">
                <Input
                  id="anzahl"
                  inputMode="numeric"
                  value={anzahl}
                  onChange={(e) => setAnzahl(e.target.value)}
                />
              </Field>
              <Field
                label="Vorspannung zusätzlich"
                htmlFor="reserve"
                hint="Umdrehungen über den Hub hinaus"
              >
                <Input
                  id="reserve"
                  inputMode="decimal"
                  value={reserve}
                  onChange={(e) => setReserve(e.target.value)}
                />
              </Field>
            </div>
          </Card>
        </div>

        <Card title="Ergebnis">
          {!ergebnis ? (
            <p className="text-sm text-slate-500">
              Bitte alle Maße eintragen. Der Durchmesser muß größer sein als die Drahtstärke.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="rounded border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-600">
                  Diese Feder trägt bei {de(ergebnis.umdrehungen, 2)} Spannumdrehungen
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
                  {de(ergebnis.traegtKg, 0)} kg
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Torblattgewicht über {zahl(anzahl)} Feder(n) an einer Trommel mit {trommel} mm
                  Radius
                </p>
              </div>

              <dl className="divide-y divide-slate-100 text-sm">
                <Zeile name="Federrate" wert={`${de(ergebnis.rate, 2)} Nm je Umdrehung`} />
                <Zeile name="Moment je Feder" wert={`${de(ergebnis.momentNm, 1)} Nm`} />
                <Zeile name="Spannumdrehungen" wert={de(ergebnis.umdrehungen, 2)} />
                <Zeile
                  name="Baulänge"
                  wert={`${de(ergebnis.laengeMm, 0)} mm bei ${de(ergebnis.feder.windungen, 0)} Windungen`}
                />
                <Zeile
                  name="Mittlerer Durchmesser"
                  wert={`${de(ergebnis.feder.mittelMm, 1)} mm (Wickelverhältnis ${de(ergebnis.w, 1)})`}
                />
                <Zeile
                  name="Biegespannung"
                  wert={`${de(ergebnis.spannung.korrigiert, 0)} N/mm² (Beiwert ${de(ergebnis.spannung.beiwert, 3)})`}
                />
                <Zeile name="Zugfestigkeit" wert={`${de(ergebnis.rm, 0)} N/mm²`} />
              </dl>

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone={TON_FARBE[ergebnis.urteil.ton]}>
                    Ausnutzung {de(ergebnis.urteil.ausnutzung, 0)} %
                  </Badge>
                  <span className="text-sm text-slate-600">{TON_WORT[ergebnis.urteil.ton]}</span>
                </div>
                <div
                  className={ergebnis.urteil.ton === 'gut' ? 'meldung-erfolg' : 'meldung-hinweis'}
                >
                  {ergebnis.urteil.satz}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Zeile({ name, wert }: { name: string; wert: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-slate-600">{name}</dt>
      <dd className="text-right font-medium tabular-nums text-slate-900">{wert}</dd>
    </div>
  );
}

/* Feder auslegen -------------------------------------------------------- */

/**
 * Der seltenere, aber schwierigere Fall: kein Vergleichsstück da.
 *
 * Ausgegeben wird bewußt eine Liste statt eines Ergebnisses. Welche Feder in
 * Frage kommt, entscheidet nicht die Rechnung allein, sondern der Platz auf
 * der Welle und das, was der Lieferant führt.
 */
function Auslegen() {
  const parameter = useSearchParams();

  const [gewicht, setGewicht] = useState(parameter.get('gewicht') ?? '100');
  const [hoehe, setHoehe] = useState(parameter.get('hoehe') ?? '2125');
  const [trommel, setTrommel] = useState('46');
  const [anzahl, setAnzahl] = useState('2');
  const [innen, setInnen] = useState('67');
  const [reserve, setReserve] = useState('0,75');
  const [maxLaenge, setMaxLaenge] = useState('');
  const [guete, setGuete] = useState<Guete>('DH');

  const vorschlaege = useMemo(() => {
    const g = zahl(gewicht);
    const h = zahl(hoehe);
    const r = zahl(trommel);
    const anz = zahl(anzahl);
    const i = zahl(innen);
    if (!g || !h || !r || !anz || !i) return null;

    return auslegen({
      gewichtKg: g,
      hoeheMm: h,
      trommelRadiusMm: r,
      anzahlFedern: anz,
      innenMm: i,
      reserveUmdrehungen: zahl(reserve) ?? 0,
      ...(zahl(maxLaenge) ? { maxLaengeMm: zahl(maxLaenge)! } : {}),
      guete,
    });
  }, [gewicht, hoehe, trommel, anzahl, innen, reserve, maxLaenge, guete]);

  return (
    <div className="space-y-6">
      <Card title="Das Tor">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Torblattgewicht" htmlFor="a-gewicht" hint="in kg">
            <Input
              id="a-gewicht"
              inputMode="decimal"
              value={gewicht}
              onChange={(e) => setGewicht(e.target.value)}
            />
          </Field>
          <Field label="Torhöhe" htmlFor="a-hoehe" hint="in mm">
            <Input
              id="a-hoehe"
              inputMode="decimal"
              value={hoehe}
              onChange={(e) => setHoehe(e.target.value)}
            />
          </Field>
          <Field label="Trommelradius" htmlFor="a-trommel" hint="in mm">
            <Input
              id="a-trommel"
              inputMode="decimal"
              value={trommel}
              onChange={(e) => setTrommel(e.target.value)}
            />
          </Field>
          <Field label="Anzahl Federn" htmlFor="a-anzahl">
            <Input
              id="a-anzahl"
              inputMode="numeric"
              value={anzahl}
              onChange={(e) => setAnzahl(e.target.value)}
            />
          </Field>
          <Field label="Innendurchmesser" htmlFor="a-innen" hint="in mm, durch die Welle bestimmt">
            <Input
              id="a-innen"
              inputMode="decimal"
              value={innen}
              onChange={(e) => setInnen(e.target.value)}
            />
          </Field>
          <Field label="Vorspannung zusätzlich" htmlFor="a-reserve" hint="Umdrehungen über den Hub">
            <Input
              id="a-reserve"
              inputMode="decimal"
              value={reserve}
              onChange={(e) => setReserve(e.target.value)}
            />
          </Field>
          <Field label="Platz je Feder" htmlFor="a-max" hint="in mm, freiwillig">
            <Input
              id="a-max"
              inputMode="decimal"
              placeholder="ohne Begrenzung"
              value={maxLaenge}
              onChange={(e) => setMaxLaenge(e.target.value)}
            />
          </Field>
          <Field label="Drahtgüte" htmlFor="a-guete">
            <Select id="a-guete" value={guete} onChange={(e) => setGuete(e.target.value as Guete)}>
              {Object.entries(GUETEN).map(([schluessel, name]) => (
                <option key={schluessel} value={schluessel}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card
        title="Vorschläge"
        bodyClassName=""
        actions={
          vorschlaege && (
            <span className="text-xs text-slate-500">
              {de(vorschlaege[0].spannUmdrehungen, 2)} Spannumdrehungen
            </span>
          )
        }
      >
        {!vorschlaege ? (
          <div className="p-5 text-sm text-slate-500">
            Bitte Gewicht, Höhe und Trommel eintragen.
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Draht</th>
                <th className="text-right">Windungen</th>
                <th className="text-right">Baulänge</th>
                <th className="text-right">Nm/Umdr.</th>
                <th className="text-right">Moment</th>
                <th className="text-right">trägt</th>
                <th className="text-right">Spannung</th>
                {/* Anteil der Zugfestigkeit – nicht die verbleibende Reserve. */}
                <th>Ausnutzung</th>
              </tr>
            </thead>
            <tbody>
              {vorschlaege.map((vorschlag) => (
                <VorschlagZeile key={vorschlag.drahtMm} vorschlag={vorschlag} />
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="meldung-hinweis">
        Die Windungszahl ist auf ganze Windungen gerundet – so wird gewickelt. Alle weiteren Werte
        der Zeile gelten für die gerundete Feder, nicht für die rechnerische; deshalb weicht das
        getragene Gewicht um wenige Kilogramm ab.
      </p>
    </div>
  );
}

function VorschlagZeile({ vorschlag }: { vorschlag: Vorschlag }) {
  return (
    <tr className={vorschlag.passtAufWelle ? undefined : 'opacity-50'}>
      <td className="font-medium tabular-nums">
        {de(vorschlag.drahtMm, 1)} mm
        {!vorschlag.passtAufWelle && (
          <span className="ml-2 text-xs font-normal text-slate-500">zu lang</span>
        )}
      </td>
      <td className="text-right tabular-nums">{vorschlag.windungen}</td>
      <td className="text-right tabular-nums">{de(vorschlag.baulaengeMm, 0)} mm</td>
      <td className="text-right tabular-nums">{de(vorschlag.rateNm, 2)}</td>
      <td className="text-right tabular-nums">{de(vorschlag.momentNm, 1)} Nm</td>
      <td className="text-right tabular-nums">{de(vorschlag.traegtKg, 0)} kg</td>
      <td className="text-right tabular-nums">{de(vorschlag.spannungNmm2, 0)} N/mm²</td>
      <td>
        <Badge tone={TON_FARBE[vorschlag.beurteilung.ton]}>
          {de(vorschlag.beurteilung.ausnutzung, 0)} %
        </Badge>
      </td>
    </tr>
  );
}

/* Wissen, das am Tor gebraucht wird ------------------------------------- */

function MesshinweiseKarte() {
  return (
    <Card title="An der gebrochenen Feder">
      <ol className="space-y-3 text-sm text-slate-700">
        <li>
          <strong>Drahtstärke</strong> über 20 zusammengeschobene Windungen messen und teilen –
          nicht über eine einzelne.
        </li>
        <li>
          <strong>Innendurchmesser</strong> in der Windung messen. Oft steht er auch auf dem
          Spannkonus.
        </li>
        <li>
          <strong>Länge</strong> über beide Bruchstücke zusammen. Eine gebrochene Torsionsfeder
          verliert kein Material.
        </li>
        <li>
          <strong>Wickelrichtung</strong> am Drahtende ablesen: Steigen die Windungen wie ein
          gewöhnliches Rechtsgewinde an, ist sie rechtsgewickelt. Die Verwechslung merkt man erst
          beim Einbau – und Farbmarkierungen am Konus sind herstellerabhängig, also kein Beleg.
        </li>
        <li>
          <strong>Zyklen</strong> stehen nicht an der Feder. Bei Markentoren ist der
          Ersatzteilkatalog des Herstellers die bessere Quelle als jede Rechnung.
        </li>
      </ol>
    </Card>
  );
}

function GrundlagenKarte() {
  return (
    <Card title="Woran die Rechnung hängt">
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          Eine Torsionsfeder wird beim Aufdrehen nicht verdreht, sondern gebogen. Daraus folgt das
          Drehmoment je Umdrehung:
        </p>
        <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs leading-5">
          {'M = π · E · d⁴ / (32 · Dm · n)'}
        </pre>
        <p>
          Für die Haltbarkeit zählt aber nicht das Moment, sondern die Spannung im Draht – und die
          kürzt sich zu <span className="whitespace-nowrap">σ = E · d · Δn / (Dm · n)</span>. Darin
          steht das Entscheidende: Die Spannung hängt allein davon ab, wie weit man eine gegebene
          Feder aufdreht.
        </p>
        <p>
          Deshalb bringt ein <em>dickerer</em> Draht allein nichts. Der Weg zu mehr Zyklen ist eine{' '}
          <strong>größere</strong> Feder – mehr Windungen oder größerer Durchmesser – bei gleichem
          Moment.
        </p>
        <p className="meldung-hinweis">
          Der Rechner ist eine Rechenhilfe, keine Freigabe. Eine Zyklenzahl liefert er bewußt nicht:
          Dafür braucht es das Dauerfestigkeitsschaubild des Drahtherstellers, nicht eine Formel.
          Was eingebaut wird, verantwortet der Betrieb.
        </p>
      </div>
    </Card>
  );
}
