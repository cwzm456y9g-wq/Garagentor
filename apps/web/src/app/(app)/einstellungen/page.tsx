'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingState,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Textarea,
} from '@/components/ui';
import {
  baseRateOutdated,
  CHART_OF_ACCOUNTS,
  DEFAULT_BASE_RATE,
  interestRate,
  MAIL_DOCUMENT_TYPES,
  MAIL_PLACEHOLDERS,
  MAIL_TEMPLATE_DEFAULTS,
  type MailDocumentType,
} from '@garagentor/shared';
import { api } from '@/lib/api-client';
import { useAction, useApi } from '@/lib/hooks';
import { werkstattlisten, type Federreihe, type Trommel, type Werkstattlisten } from '@/lib/federn';
import type {
  CompanySettings,
  DatevSettings,
  DocumentSettings,
  DunningLevelSetting,
  DunningSettings,
  InspectionSettings,
  MailSettings,
  NumberRange,
  Setting,
  SettingPreset,
} from '@/lib/types';

/** Anzeigenamen der Nummernkreise. */
const ENTITY_LABELS: Record<string, string> = {
  CUSTOMER: 'Kunden',
  QUOTE: 'Angebote',
  ORDER: 'Aufträge',
  INVOICE: 'Rechnungen',
  SERVICE_REPORT: 'Serviceberichte',
  INSPECTION: 'Prüfprotokolle',
  PROJECT: 'Projekte',
  PURCHASE_ORDER: 'Bestellungen',
  SUPPLIER: 'Lieferanten',
  ARTICLE: 'Artikel',
  DOOR: 'Toranlagen',
  EMPLOYEE: 'Mitarbeiter',
  MAINTENANCE_CONTRACT: 'Wartungsverträge',
};

const MAIL_LABELS: Record<MailDocumentType, string> = {
  ANGEBOT: 'Angebot',
  RECHNUNG: 'Rechnung',
  MAHNUNG: 'Mahnung',
  SERVICEBERICHT: 'Servicebericht',
  PRUEFBESCHEINIGUNG: 'Prüfbescheinigung',
  PRUEFPROTOKOLL: 'Prüfprotokoll (auf Wunsch)',
};

const DUNNING_LABELS: Record<string, string> = {
  ZAHLUNGSERINNERUNG: 'Zahlungserinnerung',
  MAHNUNG_1: '1. Mahnung',
  MAHNUNG_2: '2. Mahnung',
  LETZTE_MAHNUNG: 'Letzte Mahnung',
};

/** Obergrenze des Logos; dieselbe Grenze prüft auch die Schnittstelle. */
const LOGO_MAX_KB = 512;

export default function SettingsPage() {
  const settings = useApi<Setting[]>('/settings');
  const ranges = useApi<NumberRange[]>('/settings/number-ranges');

  const wertVon = <T,>(key: string): T | undefined =>
    settings.data?.find((setting) => setting.key === key)?.value as T | undefined;

  return (
    <>
      <PageHeader
        title="Einstellungen"
        subtitle="Firmendaten, Belegvorgaben, Mahnstufen, Prüfvorgaben und Nummernkreise"
        actions={<LinkButton href="/einstellungen/benutzer">Benutzer verwalten</LinkButton>}
      />

      {settings.error ? (
        <ErrorState message={settings.error} onRetry={settings.reload} />
      ) : settings.loading ? (
        <LoadingState />
      ) : (
        <div className="space-y-6">
          <FirmaKarte
            geladen={wertVon<CompanySettings>('firma') ?? {}}
            neuLaden={settings.reload}
          />
          <BelegeKarte
            geladen={wertVon<DocumentSettings>('belege') ?? {}}
            neuLaden={settings.reload}
          />
          <MahnwesenKarte
            geladen={wertVon<DunningSettings>('mahnwesen') ?? {}}
            neuLaden={settings.reload}
          />
          <PruefungKarte
            geladen={wertVon<InspectionSettings>('pruefung') ?? {}}
            neuLaden={settings.reload}
          />
          <PostausgangKarte
            geladen={wertVon<MailSettings>('mail') ?? {}}
            neuLaden={settings.reload}
          />
          <DatevKarte geladen={wertVon<DatevSettings>('datev') ?? {}} neuLaden={settings.reload} />
          <FedernKarte geladen={wertVon<unknown>('federn')} neuLaden={settings.reload} />
          <AblageKarte />
          <SicherungKarte />
          <NummernkreiseKarte ranges={ranges} />
          <ZuruecksetzenKarte onFertig={ranges.reload} />
        </div>
      )}
    </>
  );
}

/* Vorlagen ------------------------------------------------------------- */

/**
 * Hält den aktuellen Stand einer Einstellungsgruppe unter einem Namen fest.
 * Eine Vorlage kann als Favorit markiert werden – die steht oben und ist mit
 * einem Klick wieder eingesetzt.
 */
function VorlagenLeiste({
  settingKey,
  bezeichnung,
  neuLaden,
}: {
  settingKey: string;
  bezeichnung: string;
  neuLaden: () => void;
}) {
  const vorlagen = useApi<SettingPreset[]>(`/settings/${settingKey}/presets`);
  const [name, setName] = useState('');
  const [alsFavorit, setAlsFavorit] = useState(false);
  const [offen, setOffen] = useState(false);

  const speichern = useAction(() =>
    api.post(`/settings/${settingKey}/presets`, { name, favorite: alsFavorit }),
  );
  const einsetzen = useAction((id: string) =>
    api.post(`/settings/${settingKey}/presets/${id}/apply`),
  );
  const favorit = useAction((id: string) =>
    api.patch(`/settings/${settingKey}/presets/${id}/favorite`),
  );
  const entfernen = useAction((id: string) => api.delete(`/settings/${settingKey}/presets/${id}`));

  const liste = vorlagen.data ?? [];
  const fehler = speichern.error ?? einsetzen.error ?? favorit.error ?? entfernen.error;

  return (
    <div className="border-t border-slate-200 px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Vorlagen
        </span>
        {liste.length === 0 && !offen && (
          <span className="text-xs text-slate-500">noch keine gespeichert</span>
        )}
        {liste.map((vorlage) => (
          <span
            key={vorlage.id}
            className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-2 pr-1 text-xs"
          >
            <button
              type="button"
              onClick={async () => {
                if (await favorit.run(vorlage.id)) vorlagen.reload();
              }}
              title={vorlage.favorite ? 'Ist Favorit' : 'Als Favorit markieren'}
              aria-label={`${vorlage.name} als Favorit markieren`}
              className={vorlage.favorite ? 'text-bernstein-500' : 'text-slate-300'}
            >
              ★
            </button>
            <span className="font-medium text-slate-700">{vorlage.name}</span>
            <button
              type="button"
              onClick={async () => {
                if (await einsetzen.run(vorlage.id)) {
                  neuLaden();
                }
              }}
              className="text-verweis hover:underline"
            >
              einsetzen
            </button>
            <button
              type="button"
              onClick={async () => {
                if (await entfernen.run(vorlage.id)) vorlagen.reload();
              }}
              className="px-1 text-slate-400 hover:text-fehler"
              aria-label={`Vorlage ${vorlage.name} entfernen`}
            >
              ×
            </button>
          </span>
        ))}

        {offen ? (
          <span className="flex flex-wrap items-center gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={`${bezeichnung} vom ${new Date().toLocaleDateString('de-DE')}`}
              className="w-56"
              aria-label="Name der Vorlage"
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={alsFavorit}
                onChange={(event) => setAlsFavorit(event.target.checked)}
                className="rounded border-slate-300"
              />
              als Favorit
            </label>
            <Button
              size="sm"
              loading={speichern.loading}
              disabled={!name.trim()}
              onClick={async () => {
                if (await speichern.run()) {
                  setName('');
                  setAlsFavorit(false);
                  setOffen(false);
                  vorlagen.reload();
                }
              }}
            >
              Sichern
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setOffen(true)}>
            Aktuellen Stand sichern
          </Button>
        )}
      </div>
      {fehler && <p className="error-text">{fehler}</p>}
    </div>
  );
}

/* Firmendaten ---------------------------------------------------------- */

const FIRMA_FELDER: Array<{ feld: keyof CompanySettings; label: string; hinweis?: string }> = [
  { feld: 'name', label: 'Firmenname' },
  { feld: 'street', label: 'Straße und Hausnummer' },
  { feld: 'zip', label: 'Postleitzahl' },
  { feld: 'city', label: 'Ort' },
  { feld: 'country', label: 'Land' },
  { feld: 'phone', label: 'Telefon' },
  { feld: 'email', label: 'E-Mail' },
  { feld: 'website', label: 'Internet' },
  { feld: 'taxNumber', label: 'Steuernummer', hinweis: 'Gehört auf die Rechnung.' },
  { feld: 'vatId', label: 'USt-IdNr.' },
  { feld: 'managingDirector', label: 'Geschäftsführung' },
  { feld: 'registerCourt', label: 'Registergericht' },
  { feld: 'registerNumber', label: 'Handelsregisternummer' },
  { feld: 'bankName', label: 'Bank' },
  { feld: 'iban', label: 'IBAN' },
  { feld: 'bic', label: 'BIC' },
];

function FirmaKarte({ geladen, neuLaden }: { geladen: CompanySettings; neuLaden: () => void }) {
  const [entwurf, setEntwurf] = useState<CompanySettings | null>(null);
  const [logoFehler, setLogoFehler] = useState<string | null>(null);
  const dateiFeld = useRef<HTMLInputElement>(null);
  const wert = entwurf ?? geladen;
  const geaendert = entwurf !== null && JSON.stringify(entwurf) !== JSON.stringify(geladen);

  const speichern = useAction((body: CompanySettings) =>
    api.put('/settings/firma', { value: body, category: 'stammdaten' }),
  );

  const setzen = (feld: keyof CompanySettings, neu: string) => setEntwurf({ ...wert, [feld]: neu });

  const logoLesen = (datei: File) => {
    setLogoFehler(null);
    if (datei.size > LOGO_MAX_KB * 1024) {
      setLogoFehler(
        `Die Datei ist ${Math.round(datei.size / 1024)} kB groß; erlaubt sind ${LOGO_MAX_KB} kB.`,
      );
      return;
    }
    const leser = new FileReader();
    leser.onerror = () => setLogoFehler('Die Datei konnte nicht gelesen werden.');
    leser.onload = () => setEntwurf({ ...wert, logo: String(leser.result) });
    leser.readAsDataURL(datei);
  };

  return (
    <Card
      title="Firmendaten"
      bodyClassName=""
      actions={
        <Button
          size="sm"
          loading={speichern.loading}
          disabled={!geaendert}
          onClick={async () => {
            if (await speichern.run(wert)) {
              setEntwurf(null);
              neuLaden();
            }
          }}
        >
          {geaendert ? 'Speichern' : 'Gespeichert'}
        </Button>
      }
    >
      <div className="card-body space-y-5">
        {speichern.error && <ErrorState message={speichern.error} />}

        <div>
          <span className="label">Logo</span>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-40 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-2">
              {wert.logo ? (
                // Eine Data-URL aus der eigenen Datenbank; der Bildoptimierer
                // von Next kann damit nichts anfangen, deshalb ein einfaches img.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={wert.logo}
                  alt="Logo des Betriebs"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-xs text-slate-400">kein Logo</span>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={dateiFeld}
                type="file"
                accept="image/svg+xml,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const datei = event.target.files?.[0];
                  if (datei) logoLesen(datei);
                  event.target.value = '';
                }}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => dateiFeld.current?.click()}>
                  Datei wählen
                </Button>
                {wert.logo && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEntwurf({ ...wert, logo: '' })}
                  >
                    Entfernen
                  </Button>
                )}
              </div>
              <p className="hint">
                SVG, PNG, JPEG oder WebP, bis {LOGO_MAX_KB} kB. Erscheint auf den Belegen.
              </p>
              {logoFehler && <p className="error-text">{logoFehler}</p>}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {FIRMA_FELDER.map(({ feld, label, hinweis }) => (
            <Field key={feld} label={label} htmlFor={`firma-${feld}`} hint={hinweis}>
              <Input
                id={`firma-${feld}`}
                value={wert[feld] ?? ''}
                onChange={(event) => setzen(feld, event.target.value)}
              />
            </Field>
          ))}
        </div>
      </div>

      <VorlagenLeiste settingKey="firma" bezeichnung="Firmendaten" neuLaden={neuLaden} />
    </Card>
  );
}

/* Belegvorgaben -------------------------------------------------------- */

function BelegeKarte({ geladen, neuLaden }: { geladen: DocumentSettings; neuLaden: () => void }) {
  const [entwurf, setEntwurf] = useState<DocumentSettings | null>(null);
  const wert = entwurf ?? geladen;
  const geaendert = entwurf !== null && JSON.stringify(entwurf) !== JSON.stringify(geladen);

  const speichern = useAction((body: DocumentSettings) =>
    api.put('/settings/belege', { value: body, category: 'belege' }),
  );

  return (
    <Card
      title="Belegvorgaben"
      bodyClassName=""
      actions={
        <Button
          size="sm"
          loading={speichern.loading}
          disabled={!geaendert}
          onClick={async () => {
            if (await speichern.run(wert)) {
              setEntwurf(null);
              neuLaden();
            }
          }}
        >
          {geaendert ? 'Speichern' : 'Gespeichert'}
        </Button>
      }
    >
      <div className="card-body space-y-5">
        {speichern.error && <ErrorState message={speichern.error} />}

        <label className="flex items-start gap-2.5 rounded-md bg-slate-50 px-4 py-3">
          <input
            type="checkbox"
            checked={wert.kleinunternehmer === true}
            onChange={(event) =>
              // Der Steuersatz folgt dem Schalter: sonst entstünden Positionen
              // mit 19 %, die auf dem Beleg als steuerpflichtig gelten.
              setEntwurf({
                ...wert,
                kleinunternehmer: event.target.checked,
                defaultVatRate: event.target.checked ? 0 : (wert.defaultVatRate ?? 19) || 19,
              })
            }
            className="mt-0.5 rounded border-slate-300"
          />
          <span className="text-sm">
            <span className="font-medium">Kleinunternehmerregelung nach § 19 UStG</span>
            <span className="mt-0.5 block text-slate-600">
              Belege ohne Umsatzsteuerausweis, dafür mit dem Pflichthinweis. Die Steuerlogik bleibt
              erhalten: wird die Umsatzgrenze im laufenden Jahr gerissen, genügt das Entfernen
              dieses Hakens.
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Umsatzsteuersatz"
            htmlFor="belege-ust"
            hint={
              wert.kleinunternehmer
                ? 'Ohne Steuerausweis nach § 19 UStG.'
                : 'Vorbelegung neuer Positionen.'
            }
          >
            <Select
              id="belege-ust"
              disabled={wert.kleinunternehmer === true}
              value={String(wert.defaultVatRate ?? 19)}
              onChange={(event) =>
                setEntwurf({ ...wert, defaultVatRate: Number(event.target.value) })
              }
            >
              <option value="0">0 %</option>
              <option value="7">7 %</option>
              <option value="19">19 %</option>
            </Select>
          </Field>
          <Field label="Zahlungsziel in Tagen" htmlFor="belege-ziel">
            <Input
              id="belege-ziel"
              type="number"
              min={0}
              max={180}
              value={wert.defaultPaymentTermsDays ?? 14}
              onChange={(event) =>
                setEntwurf({ ...wert, defaultPaymentTermsDays: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Angebot gültig für Tage" htmlFor="belege-gueltig">
            <Input
              id="belege-gueltig"
              type="number"
              min={1}
              max={365}
              value={wert.quoteValidityDays ?? 30}
              onChange={(event) =>
                setEntwurf({ ...wert, quoteValidityDays: Number(event.target.value) })
              }
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Skonto in Prozent" htmlFor="belege-skonto" hint="0 lässt den Abzug weg.">
            <Input
              id="belege-skonto"
              type="number"
              step="0.5"
              min={0}
              max={20}
              value={wert.skontoPercent ?? 0}
              onChange={(event) =>
                setEntwurf({ ...wert, skontoPercent: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Skontofrist in Tagen" htmlFor="belege-skonto-tage">
            <Input
              id="belege-skonto-tage"
              type="number"
              min={0}
              max={90}
              value={wert.skontoDays ?? 0}
              onChange={(event) => setEntwurf({ ...wert, skontoDays: Number(event.target.value) })}
            />
          </Field>
          <Field
            label="Toleranz beim Abgleich"
            htmlFor="belege-toleranz"
            hint="In Euro. Deckt das Runden des Kunden ab."
          >
            <Input
              id="belege-toleranz"
              type="number"
              step="0.01"
              min={0}
              max={5}
              value={wert.skontoToleranz ?? 0.05}
              onChange={(event) =>
                setEntwurf({ ...wert, skontoToleranz: Number(event.target.value) })
              }
            />
          </Field>
        </div>

        <div className="grid gap-4">
          <Field label="Einleitungstext im Angebot" htmlFor="belege-intro">
            <Textarea
              id="belege-intro"
              value={wert.quoteIntroText ?? ''}
              onChange={(event) => setEntwurf({ ...wert, quoteIntroText: event.target.value })}
            />
          </Field>
          <Field label="Schlusstext im Angebot" htmlFor="belege-outro">
            <Textarea
              id="belege-outro"
              value={wert.quoteOutroText ?? ''}
              onChange={(event) => setEntwurf({ ...wert, quoteOutroText: event.target.value })}
            />
          </Field>
          <Field label="Schlusstext in der Rechnung" htmlFor="belege-rechnung">
            <Textarea
              id="belege-rechnung"
              value={wert.invoiceOutroText ?? ''}
              onChange={(event) => setEntwurf({ ...wert, invoiceOutroText: event.target.value })}
            />
          </Field>
        </div>
      </div>

      <VorlagenLeiste settingKey="belege" bezeichnung="Belegvorgaben" neuLaden={neuLaden} />
    </Card>
  );
}

/* Mahnstufen ----------------------------------------------------------- */

function MahnwesenKarte({ geladen, neuLaden }: { geladen: DunningSettings; neuLaden: () => void }) {
  const [entwurf, setEntwurf] = useState<DunningSettings | null>(null);
  const wert = entwurf ?? geladen;
  const geaendert = entwurf !== null && JSON.stringify(entwurf) !== JSON.stringify(geladen);

  const speichern = useAction((body: DunningSettings) =>
    api.put('/settings/mahnwesen', { value: body, category: 'mahnwesen' }),
  );

  const basiszinssatz = wert.basiszinssatz ?? DEFAULT_BASE_RATE.percent;
  const gueltigAb = wert.basiszinssatzGueltigAb ?? DEFAULT_BASE_RATE.validFrom;
  const veraltet = baseRateOutdated(gueltigAb);
  const punkte = {
    VERBRAUCHER: wert.zinspunkteVerbraucher ?? 5,
    UNTERNEHMEN: wert.zinspunkteUnternehmen ?? 9,
  };
  const stufen = wert.stufen ?? [];

  const setzen = (index: number, feld: keyof DunningLevelSetting, neu: number | boolean) =>
    setEntwurf({
      ...wert,
      stufen: stufen.map((stufe, i) => (i === index ? { ...stufe, [feld]: neu } : stufe)),
    });

  return (
    <Card
      title="Mahnstufen"
      bodyClassName=""
      actions={
        <Button
          size="sm"
          loading={speichern.loading}
          disabled={!geaendert}
          onClick={async () => {
            if (await speichern.run(wert)) {
              setEntwurf(null);
              neuLaden();
            }
          }}
        >
          {geaendert ? 'Speichern' : 'Gespeichert'}
        </Button>
      }
    >
      {speichern.error && (
        <div className="card-body">
          <ErrorState message={speichern.error} />
        </div>
      )}

      <div className="card-body space-y-4 border-b border-slate-200">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field
            label="Basiszinssatz in Prozent"
            htmlFor="mahn-basis"
            hint="Nach § 247 BGB, von der Bundesbank bekanntgegeben."
          >
            <Input
              id="mahn-basis"
              type="number"
              step={0.01}
              min={-5}
              max={20}
              value={basiszinssatz}
              onChange={(event) =>
                setEntwurf({ ...wert, basiszinssatz: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Gültig ab" htmlFor="mahn-gueltig" hint="1. Januar oder 1. Juli.">
            <Input
              id="mahn-gueltig"
              type="date"
              value={gueltigAb.slice(0, 10)}
              onChange={(event) =>
                setEntwurf({ ...wert, basiszinssatzGueltigAb: event.target.value })
              }
            />
          </Field>
          <Field label="Punkte bei Verbrauchern" htmlFor="mahn-punkte-v" hint="§ 288 Abs. 1 BGB.">
            <Input
              id="mahn-punkte-v"
              type="number"
              step={0.5}
              min={0}
              max={20}
              value={punkte.VERBRAUCHER}
              onChange={(event) =>
                setEntwurf({ ...wert, zinspunkteVerbraucher: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Punkte bei Unternehmen" htmlFor="mahn-punkte-u" hint="§ 288 Abs. 2 BGB.">
            <Input
              id="mahn-punkte-u"
              type="number"
              step={0.5}
              min={0}
              max={20}
              value={punkte.UNTERNEHMEN}
              onChange={(event) =>
                setEntwurf({ ...wert, zinspunkteUnternehmen: Number(event.target.value) })
              }
            />
          </Field>
        </div>

        <div className="rounded-md bg-slate-50 px-4 py-3 text-sm">
          Daraus ergibt sich:{' '}
          <strong className="tabular">
            {interestRate(basiszinssatz, true, punkte).toLocaleString('de-DE')} %
          </strong>{' '}
          bei Privatkunden,{' '}
          <strong className="tabular">
            {interestRate(basiszinssatz, false, punkte).toLocaleString('de-DE')} %
          </strong>{' '}
          bei Gewerbe, öffentlichen Auftraggebern und Hausverwaltungen.
        </div>

        {veraltet && (
          <p className="rounded-md bg-hinweis-flaeche px-4 py-3 text-sm text-hinweis">
            <strong>Der Basiszinssatz ist überholt.</strong> Seit dem hinterlegten Datum ist ein
            Bekanntgabetermin verstrichen. Den aktuellen Wert veröffentlicht die Deutsche Bundesbank
            zum 1. Januar und 1. Juli.
          </p>
        )}
      </div>

      {stufen.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">Es gelten die Vorgabewerte.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Stufe</th>
              <th className="text-right">ab Verzug (Tage)</th>
              <th className="text-right">Gebühr (€)</th>
              <th className="text-right">Nachfrist (Tage)</th>
              <th>Verzugszinsen</th>
            </tr>
          </thead>
          <tbody>
            {stufen.map((stufe, index) => (
              <tr key={stufe.level}>
                <td className="font-medium text-slate-900">
                  {DUNNING_LABELS[stufe.level] ?? stufe.level}
                </td>
                {(
                  [
                    ['daysOverdue', 0, 365, 1],
                    ['fee', 0, 999, 0.5],
                    ['graceDays', 0, 90, 1],
                  ] as Array<[keyof DunningLevelSetting, number, number, number]>
                ).map(([feld, min, max, step]) => (
                  <td key={feld} className="text-right">
                    <Input
                      type="number"
                      min={min}
                      max={max}
                      step={step}
                      value={Number(stufe[feld] ?? 0)}
                      onChange={(event) => setzen(index, feld, Number(event.target.value))}
                      className="w-24 text-right"
                      aria-label={`${feld} ${stufe.level}`}
                    />
                  </td>
                ))}
                <td>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={stufe.zinsen ?? (stufe.interestPercent ?? 0) > 0}
                      onChange={(event) => setzen(index, 'zinsen', event.target.checked)}
                      className="rounded border-slate-300"
                      aria-label={`Verzugszinsen ${stufe.level}`}
                    />
                    berechnen
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
        Der Satz ergibt sich aus dem Basiszinssatz und der Kundenart, nicht aus der Stufe. Die Stufe
        entscheidet nur, ob überhaupt Zinsen anfallen. Der angewandte Satz wird zu jeder Mahnung
        mitgeschrieben.
      </p>

      <VorlagenLeiste settingKey="mahnwesen" bezeichnung="Mahnstufen" neuLaden={neuLaden} />
    </Card>
  );
}

/* Prüfvorgaben --------------------------------------------------------- */

function PruefungKarte({
  geladen,
  neuLaden,
}: {
  geladen: InspectionSettings;
  neuLaden: () => void;
}) {
  const [entwurf, setEntwurf] = useState<InspectionSettings | null>(null);
  const wert = entwurf ?? geladen;
  const geaendert = entwurf !== null && JSON.stringify(entwurf) !== JSON.stringify(geladen);

  const speichern = useAction((body: InspectionSettings) =>
    api.put('/settings/pruefung', { value: body, category: 'branche' }),
  );

  return (
    <Card
      title="Prüfvorgaben nach ASR A1.7"
      bodyClassName=""
      actions={
        <Button
          size="sm"
          loading={speichern.loading}
          disabled={!geaendert}
          onClick={async () => {
            if (await speichern.run(wert)) {
              setEntwurf(null);
              neuLaden();
            }
          }}
        >
          {geaendert ? 'Speichern' : 'Gespeichert'}
        </Button>
      }
    >
      <div className="card-body space-y-4">
        {speichern.error && <ErrorState message={speichern.error} />}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Prüfintervall in Monaten"
            htmlFor="pruef-intervall"
            hint="Mindestens jährlich."
          >
            <Input
              id="pruef-intervall"
              type="number"
              min={1}
              max={12}
              value={wert.intervalMonths ?? 12}
              onChange={(event) =>
                setEntwurf({ ...wert, intervalMonths: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Erinnerung Tage vorher" htmlFor="pruef-erinnerung">
            <Input
              id="pruef-erinnerung"
              type="number"
              min={0}
              max={180}
              value={wert.reminderDaysBefore ?? 30}
              onChange={(event) =>
                setEntwurf({ ...wert, reminderDaysBefore: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Sachkunde erforderlich" htmlFor="pruef-sachkunde">
            <Select
              id="pruef-sachkunde"
              value={wert.requireQualifiedInspector === false ? 'nein' : 'ja'}
              onChange={(event) =>
                setEntwurf({ ...wert, requireQualifiedInspector: event.target.value === 'ja' })
              }
            >
              <option value="ja">ja</option>
              <option value="nein">nein</option>
            </Select>
          </Field>
        </div>

        <p className="text-xs text-slate-500">
          Kraftbetätigte Tore sind nach ASR A1.7 Abschnitt 10 mindestens jährlich durch eine
          sachkundige Person zu prüfen. Ein längeres Intervall lässt die Anwendung deshalb nicht zu.
        </p>
      </div>

      <VorlagenLeiste settingKey="pruefung" bezeichnung="Prüfvorgaben" neuLaden={neuLaden} />
    </Card>
  );
}

/* Postausgang ---------------------------------------------------------- */

/** Zustand des Postausgangs, wie ihn der Server meldet. */
interface MailStatusInfo {
  eingerichtet: boolean;
  host: string | null;
  port: number;
  secure: boolean;
  absender: string | null;
  einrichtung: {
    vollstaendig: boolean;
    angaben: Array<{ name: string; gesetzt: boolean; noetig: boolean; wert: string | null }>;
    warnungen: string[];
  };
}

interface Befund {
  ok: boolean;
  meldung: string;
  rat: string | null;
}

/**
 * Einrichtung und Prüfung des Postausgangs.
 *
 * Bisher stand hier nur der Hinweis, wo die Zugangsdaten hingehören. Das ist
 * richtig, half aber nicht weiter: Ob sie stimmen, zeigte sich erst, wenn eine
 * Rechnung den Kunden nicht erreichte – und die Meldung dazu war englisch und
 * nichtssagend.
 *
 * Jetzt läßt sich die Verbindung hier prüfen und eine Testmail schicken, bevor
 * der erste echte Beleg hinausgeht.
 */
function Verbindungspruefung() {
  const status = useApi<MailStatusInfo>('/mail/status');
  const [an, setAn] = useState('');
  const [befund, setBefund] = useState<Befund | null>(null);

  const pruefen = useAction(() => api.post<Befund>('/mail/pruefen'));
  const testen = useAction((adresse: string) =>
    api.post<Befund>('/mail/testmail', { an: adresse }),
  );

  const daten = status.data;
  const laeuft = pruefen.loading || testen.loading;

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-slate-700">Postausgang</span>
        {status.loading ? (
          <span className="text-slate-500">wird geprüft …</span>
        ) : daten?.einrichtung.vollstaendig ? (
          <>
            <Badge tone="success">vollständig</Badge>
            <span className="tabular text-slate-600">
              {daten.host}:{daten.port} · {daten.secure ? 'durchgehend verschlüsselt' : 'STARTTLS'}
            </span>
          </>
        ) : (
          <Badge tone="warning">
            {daten?.eingerichtet ? 'unvollständig' : 'nicht eingerichtet'}
          </Badge>
        )}
      </div>

      {/*
        Was am Server anliegt, Zeile für Zeile.

        Der Grund ist eine wiederkehrende Sackgasse: Jemand trägt die Werte in
        hPanel ein, und es geht trotzdem keine Mail hinaus. Von außen sieht ein
        Tippfehler im Namen der Variablen genauso aus wie ein falsches
        Kennwort – und ein vergessener Neustart auch. Diese Liste trennt das:
        Was hier fehlt, hat den Server nie erreicht.
      */}
      {!status.loading && daten && (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              {daten.einrichtung.angaben.map((angabe) => (
                // Hervorgehoben wird nur, was fehlt und gebraucht wird – eine
                // nicht gesetzte Blindkopie ist kein Mangel.
                <tr
                  key={angabe.name}
                  className={angabe.gesetzt || !angabe.noetig ? undefined : 'bg-hinweis-flaeche'}
                >
                  <td className="px-3 py-1.5 font-medium text-slate-700">{angabe.name}</td>
                  <td className="px-3 py-1.5 text-slate-600">
                    {angabe.gesetzt ? (
                      (angabe.wert ?? '•••••••• (gesetzt)')
                    ) : (
                      <span className="text-hinweis">
                        {angabe.noetig ? 'fehlt' : 'nicht gesetzt (freiwillig)'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!status.loading &&
        daten?.einrichtung.warnungen.map((warnung) => (
          <div key={warnung} className="meldung-hinweis">
            {warnung}
          </div>
        ))}

      {!status.loading && !daten?.eingerichtet && (
        <div className="text-xs text-slate-600">
          <p>
            Die Zugangsdaten gehören in hPanel unter „Node.js" als Umgebungsvariablen – nicht in
            diese Anwendung. So stehen sie weder in der Datenbank noch in einer Sicherung, die
            weitergereicht wird. Nach dem Eintragen die Anwendung dort neu starten.
          </p>
          <pre className="mt-2 overflow-x-auto rounded border border-slate-200 bg-white p-2 leading-5">
            {[
              'MAIL_HOST      smtp.hostinger.com',
              'MAIL_PORT      465',
              'MAIL_SECURE    true',
              'MAIL_USER      post@ihre-domain.de   (die vollständige Adresse)',
              'MAIL_PASSWORD  das Kennwort des Postfachs',
              'MAIL_FROM      Zeller Tore <post@ihre-domain.de>',
            ].join('\n')}
          </pre>
          <p className="mt-2">
            Bei Port 587 gehört MAIL_SECURE auf false. Die beiden zu verwechseln ist der häufigste
            Fehler – die Prüfung unten sagt es Ihnen dann auch.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={pruefen.loading}
          disabled={laeuft}
          onClick={async () => {
            const ergebnis = await pruefen.run();
            if (ergebnis) setBefund(ergebnis);
            status.reload();
          }}
        >
          Verbindung prüfen
        </Button>

        <div className="flex items-end gap-2">
          <Input
            id="mail-test-an"
            type="email"
            value={an}
            onChange={(event) => setAn(event.target.value)}
            placeholder="ihre@adresse.de"
            className="w-56"
          />
          <Button
            size="sm"
            variant="secondary"
            loading={testen.loading}
            disabled={laeuft || !an.trim()}
            onClick={async () => {
              const ergebnis = await testen.run(an.trim());
              if (ergebnis) setBefund(ergebnis);
            }}
          >
            Testmail senden
          </Button>
        </div>
      </div>

      {(pruefen.error ?? testen.error) && <ErrorState message={(pruefen.error ?? testen.error)!} />}

      {befund && (
        <div className={befund.ok ? 'meldung-erfolg' : 'meldung-hinweis'}>
          <p>{befund.meldung}</p>
          {befund.rat && <p className="mt-1 text-xs">{befund.rat}</p>}
        </div>
      )}
    </div>
  );
}

function PostausgangKarte({ geladen, neuLaden }: { geladen: MailSettings; neuLaden: () => void }) {
  const [entwurf, setEntwurf] = useState<MailSettings | null>(null);
  const [offen, setOffen] = useState<MailDocumentType>('RECHNUNG');
  const wert = entwurf ?? geladen;
  const geaendert = entwurf !== null && JSON.stringify(entwurf) !== JSON.stringify(geladen);

  const speichern = useAction((body: MailSettings) =>
    api.put('/settings/mail', { value: body, category: 'kommunikation' }),
  );

  const vorlage = wert.vorlagen?.[offen] ?? {};

  function setzeVorlage(patch: { betreff?: string; text?: string }) {
    setEntwurf({
      ...wert,
      vorlagen: { ...wert.vorlagen, [offen]: { ...vorlage, ...patch } },
    });
  }

  return (
    <Card
      title="Postausgang"
      bodyClassName=""
      actions={
        <Button
          size="sm"
          loading={speichern.loading}
          disabled={!geaendert}
          onClick={async () => {
            if (await speichern.run(wert)) {
              setEntwurf(null);
              neuLaden();
            }
          }}
        >
          {geaendert ? 'Speichern' : 'Gespeichert'}
        </Button>
      }
    >
      <div className="card-body space-y-4">
        {speichern.error && <ErrorState message={speichern.error} />}

        <Verbindungspruefung />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Absendername" htmlFor="mail-absender" hint="Steht vor der Adresse.">
            <Input
              id="mail-absender"
              value={wert.absender ?? ''}
              onChange={(event) => setEntwurf({ ...wert, absender: event.target.value })}
            />
          </Field>
          <Field label="Antwort an" htmlFor="mail-antwort" hint="Abweichende Antwortadresse.">
            <Input
              id="mail-antwort"
              type="email"
              value={wert.antwortAn ?? ''}
              onChange={(event) => setEntwurf({ ...wert, antwortAn: event.target.value })}
            />
          </Field>
        </div>

        <Field
          label="Signatur"
          htmlFor="mail-signatur"
          hint="Ohne Angabe wird sie aus den Firmendaten gebildet."
        >
          <Textarea
            id="mail-signatur"
            rows={4}
            value={wert.signatur ?? ''}
            onChange={(event) => setEntwurf({ ...wert, signatur: event.target.value })}
          />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Anschreiben je Belegart</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {MAIL_DOCUMENT_TYPES.map((art) => (
              <button
                key={art}
                type="button"
                onClick={() => setOffen(art)}
                className={
                  offen === art
                    ? 'bg-marine-700 rounded-md px-3 py-1.5 text-xs font-medium text-white'
                    : 'rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
                }
              >
                {MAIL_LABELS[art]}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <Field label="Betreff" htmlFor="mail-vorlage-betreff">
              <Input
                id="mail-vorlage-betreff"
                value={vorlage.betreff ?? ''}
                placeholder={MAIL_TEMPLATE_DEFAULTS[offen].betreff}
                onChange={(event) => setzeVorlage({ betreff: event.target.value })}
              />
            </Field>
            <Field
              label="Text"
              htmlFor="mail-vorlage-text"
              hint="Leer lassen, um die Vorgabe zu verwenden. Der Gruß und die Signatur kommen automatisch dazu."
            >
              <Textarea
                id="mail-vorlage-text"
                rows={8}
                value={vorlage.text ?? ''}
                placeholder={MAIL_TEMPLATE_DEFAULTS[offen].text}
                onChange={(event) => setzeVorlage({ text: event.target.value })}
              />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {MAIL_PLACEHOLDERS.map((platzhalter) => (
              <span key={platzhalter.name}>
                <code className="text-slate-700">{platzhalter.name}</code>{' '}
                {platzhalter.beschreibung}
              </span>
            ))}
          </div>
        </div>
      </div>

      <VorlagenLeiste settingKey="mail" bezeichnung="Postausgang" neuLaden={neuLaden} />
    </Card>
  );
}

/* Buchhaltung ---------------------------------------------------------- */

function DatevKarte({ geladen, neuLaden }: { geladen: DatevSettings; neuLaden: () => void }) {
  const [entwurf, setEntwurf] = useState<DatevSettings | null>(null);
  const wert = entwurf ?? geladen;
  const geaendert = entwurf !== null && JSON.stringify(entwurf) !== JSON.stringify(geladen);

  const speichern = useAction((body: DatevSettings) =>
    api.put('/settings/datev', { value: body, category: 'buchhaltung' }),
  );

  const rahmen = CHART_OF_ACCOUNTS[wert.kontenrahmen ?? 'SKR03'] ?? CHART_OF_ACCOUNTS.SKR03;

  function setzeKonto(satz: string, konto: number) {
    setEntwurf({ ...wert, erloeskonten: { ...wert.erloeskonten, [satz]: konto } });
  }

  return (
    <Card
      title="DATEV-Export"
      bodyClassName=""
      actions={
        <Button
          size="sm"
          loading={speichern.loading}
          disabled={!geaendert}
          onClick={async () => {
            if (await speichern.run(wert)) {
              setEntwurf(null);
              neuLaden();
            }
          }}
        >
          {geaendert ? 'Speichern' : 'Gespeichert'}
        </Button>
      }
    >
      <div className="card-body space-y-4">
        {speichern.error && <ErrorState message={speichern.error} />}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Beraternummer" htmlFor="datev-berater" hint="Vom Steuerberater.">
            <Input
              id="datev-berater"
              type="number"
              min={0}
              value={wert.beraternummer ?? 0}
              onChange={(event) =>
                setEntwurf({ ...wert, beraternummer: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Mandantennummer" htmlFor="datev-mandant" hint="Vom Steuerberater.">
            <Input
              id="datev-mandant"
              type="number"
              min={0}
              value={wert.mandantennummer ?? 0}
              onChange={(event) =>
                setEntwurf({ ...wert, mandantennummer: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Kontenrahmen" htmlFor="datev-rahmen">
            <Select
              id="datev-rahmen"
              value={wert.kontenrahmen ?? 'SKR03'}
              onChange={(event) =>
                setEntwurf({
                  ...wert,
                  kontenrahmen: event.target.value as DatevSettings['kontenrahmen'],
                  // Die Erlöskonten des alten Rahmens gäbe es im neuen nicht.
                  erloeskonten: undefined,
                })
              }
            >
              {Object.keys(CHART_OF_ACCOUNTS).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Sachkontenlänge" htmlFor="datev-laenge" hint="Muss zur Kanzlei passen.">
            <Input
              id="datev-laenge"
              type="number"
              min={4}
              max={8}
              value={wert.sachkontenlaenge ?? 4}
              onChange={(event) =>
                setEntwurf({ ...wert, sachkontenlaenge: Number(event.target.value) })
              }
            />
          </Field>
          <Field
            label="Debitoren ab"
            htmlFor="datev-debitor"
            hint="Basis für Kunden ohne eigenes Konto."
          >
            <Input
              id="datev-debitor"
              type="number"
              min={1}
              value={wert.debitorBasis ?? rahmen.debitorBasis}
              onChange={(event) =>
                setEntwurf({ ...wert, debitorBasis: Number(event.target.value) })
              }
            />
          </Field>
          <Field
            label="Festschreiben"
            htmlFor="datev-festschreibung"
            hint="Festgeschriebene Buchungen sind in DATEV nicht mehr änderbar."
          >
            <Select
              id="datev-festschreibung"
              value={wert.festschreibung ? 'ja' : 'nein'}
              onChange={(event) =>
                setEntwurf({ ...wert, festschreibung: event.target.value === 'ja' })
              }
            >
              <option value="nein">nein</option>
              <option value="ja">ja</option>
            </Select>
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Erlöskonten je Steuersatz</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {Object.entries(rahmen.erloese).map(([satz, vorgabe]) => (
              <Field key={satz} label={`${satz} % Umsatzsteuer`} htmlFor={`datev-konto-${satz}`}>
                <Input
                  id={`datev-konto-${satz}`}
                  type="number"
                  min={1}
                  value={wert.erloeskonten?.[satz] ?? vorgabe}
                  onChange={(event) => setzeKonto(satz, Number(event.target.value))}
                />
              </Field>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Es sind Automatikkonten: der Steuerschlüssel ergibt sich in DATEV aus dem Konto, deshalb
            bleibt das Feld BU-Schlüssel im Export leer.
          </p>
        </div>
      </div>

      <VorlagenLeiste settingKey="datev" bezeichnung="DATEV-Vorgaben" neuLaden={neuLaden} />
    </Card>
  );
}

/* Dateiablage ---------------------------------------------------------- */

interface AblageStatus {
  eingerichtet: boolean;
  adresse: string | null;
  bucket: string;
  schluesselGesetzt: boolean;
}

interface AblageBefund extends Befund {
  schritte: string[];
}

/**
 * Einrichtung und Prüfung der Dateiablage.
 *
 * Hochgeladene Dateien liegen nicht auf dem Webhosting, sondern in Supabase
 * Storage – auf geteiltem Webhosting übersteht eine Datei das nächste
 * Ausrollen nicht zuverlässig, und ein Prüfprotokoll ohne seine Fotos ist als
 * Nachweis wertlos.
 *
 * Fehlt die Einrichtung, scheitert jeder Upload. Das stand vorher nur in der
 * Fehlermeldung beim Versuch; hier steht es vorher – mit den Werten, die
 * einzutragen sind, und einer Prüfung, die eine Datei wirklich hin- und
 * zurückschickt.
 */
function AblageKarte() {
  const status = useApi<AblageStatus>('/ablage');
  const [befund, setBefund] = useState<AblageBefund | null>(null);
  const pruefen = useAction(() => api.post<AblageBefund>('/ablage/pruefen'));

  const daten = status.data;

  return (
    <Card title="Dateiablage">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-slate-700">Ablage</span>
          {status.loading ? (
            <span className="text-slate-500">wird geprüft …</span>
          ) : daten?.eingerichtet ? (
            <>
              <Badge tone="success">eingerichtet</Badge>
              <span className="text-slate-600">
                {daten.adresse} · Ablagefach „{daten.bucket}“
              </span>
            </>
          ) : (
            <Badge tone="warning">nicht eingerichtet</Badge>
          )}
        </div>

        <p className="text-sm text-slate-600">
          Hochgeladene Dateien – Fotos von der Baustelle, eingescannte Unterlagen – liegen in
          Supabase Storage und nicht auf dem Webhosting. Ohne diese Einrichtung schlägt jeder Upload
          fehl.
        </p>

        {!status.loading && !daten?.eingerichtet && (
          <div className="text-xs text-slate-600">
            <p>Diese Werte gehören in hPanel unter „Node.js“; danach dort neu starten:</p>
            <pre className="mt-2 overflow-x-auto rounded border border-slate-200 bg-white p-2 leading-5">
              {[
                'SUPABASE_URL                https://<kennung>.supabase.co',
                'SUPABASE_SERVICE_ROLE_KEY   der lange Schlüssel (service_role)',
                'SUPABASE_BUCKET             dokumente        (freiwillig)',
              ].join('\n')}
            </pre>
            <p className="mt-2">
              Beides steht in Supabase unter Project Settings → API. Wichtig ist der Wert bei
              <strong> service_role</strong>, nicht der bei <em>anon</em>: Der anon-Schlüssel
              unterliegt den Zugriffsregeln der Datenbank und wird abgewiesen. Der
              service_role-Schlüssel gehört ausschließlich auf den Server – niemals in eine Mail und
              niemals in den Browser.
            </p>
          </div>
        )}

        <div>
          <Button
            variant="secondary"
            loading={pruefen.loading}
            onClick={async () => {
              const ergebnis = await pruefen.run();
              if (ergebnis) setBefund(ergebnis);
              status.reload();
            }}
          >
            Ablage prüfen
          </Button>
        </div>

        {pruefen.error && <ErrorState message={pruefen.error} />}

        {befund && (
          <div className={befund.ok ? 'meldung-erfolg' : 'meldung-hinweis'}>
            <p>{befund.meldung}</p>
            {befund.rat && <p className="mt-1 text-xs">{befund.rat}</p>}
            {befund.schritte.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs">
                {befund.schritte.map((schritt) => (
                  <li key={schritt}>{schritt}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/* Sicherung ------------------------------------------------------------ */

/**
 * Die eigene Sicherung zum Herunterladen.
 *
 * Der Anbieter sichert die Datenbank für sich – das hilft bei einem Ausfall
 * seiner Technik, aber nicht bei einem versehentlich gelöschten Kunden, einem
 * Anbieterwechsel oder einer Betriebsprüfung. Dafür braucht es eine Datei, die
 * dem Betrieb gehört und die er selbst weglegen kann.
 */
function SicherungKarte() {
  const [mitDokumenten, setMitDokumenten] = useState(false);
  const laden = useAction(() =>
    api.downloadFile('/exports/sicherung', { dokumente: mitDokumenten ? 'true' : 'false' }),
  );

  return (
    <Card title="Sicherung">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Lädt alle Daten als ZIP herunter: je Tabelle eine CSV zum Ansehen in Excel und dieselbe
          Tabelle als JSON zum Wiedereinspielen. Ein beiliegender Zettel erklärt, was darin steht.
        </p>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-slate-300"
            checked={mitDokumenten}
            onChange={(event) => setMitDokumenten(event.target.checked)}
          />
          <span>
            Hochgeladene Dateien mitsichern
            <span className="block text-xs text-slate-500">
              Fotos und eingescannte Unterlagen. Das dauert länger und macht die Datei deutlich
              größer – Belege wie Rechnungen entstehen ohnehin neu aus den Daten, ein Foto von der
              Baustelle nicht.
            </span>
          </span>
        </label>

        <p className="meldung-hinweis">
          In der Datei stehen der vollständige Kundenstamm und Personaldaten. Sie gehört an einen
          Ort, zu dem sonst niemand Zugang hat – nicht in einen Mailanhang. Kennwörter sind nicht
          enthalten, auch nicht verschlüsselt.
        </p>

        {laden.error && <ErrorState message={laden.error} />}

        <Button loading={laden.loading} onClick={() => void laden.run()}>
          Sicherung herunterladen
        </Button>
      </div>
    </Card>
  );
}

/* Federrechner --------------------------------------------------------- */

/**
 * Trommeln und Federreihen, die der Betrieb führt.
 *
 * Der Federrechner soll keine Zahlen abfragen, die ohnehin immer dieselben
 * sind. Welche das sind, weiß aber nur der Betrieb – deshalb steht die Liste
 * hier und nicht im Programm. Wer einen Lieferanten wechselt, ändert sie
 * selbst.
 *
 * Sind keine Listen hinterlegt, arbeitet der Rechner mit Vorgaben weiter.
 */
function FedernKarte({ geladen, neuLaden }: { geladen: unknown; neuLaden: () => void }) {
  const vorhanden = useMemo(() => werkstattlisten(geladen), [geladen]);
  const [entwurf, setEntwurf] = useState<Werkstattlisten | null>(null);
  const wert = entwurf ?? vorhanden;
  const geaendert = entwurf !== null && JSON.stringify(entwurf) !== JSON.stringify(vorhanden);

  const speichern = useAction((body: Werkstattlisten) =>
    api.put('/settings/federn', { value: body, category: 'toranlagen' }),
  );

  const setzeTrommel = (index: number, felder: Partial<Trommel>) =>
    setEntwurf({
      ...wert,
      trommeln: wert.trommeln.map((eintrag, i) =>
        i === index ? { ...eintrag, ...felder } : eintrag,
      ),
    });

  const setzeReihe = (index: number, felder: Partial<Federreihe>) =>
    setEntwurf({
      ...wert,
      reihen: wert.reihen.map((eintrag, i) => (i === index ? { ...eintrag, ...felder } : eintrag)),
    });

  return (
    <Card
      title="Federrechner"
      actions={
        <Button
          size="sm"
          loading={speichern.loading}
          disabled={!geaendert}
          onClick={async () => {
            if (await speichern.run(wert)) {
              setEntwurf(null);
              neuLaden();
            }
          }}
        >
          Speichern
        </Button>
      }
    >
      <div className="space-y-6">
        {speichern.error && <ErrorState message={speichern.error} />}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-800">Seiltrommeln</h3>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setEntwurf({ ...wert, trommeln: [...wert.trommeln, { name: '', radiusMm: 46 }] })
              }
            >
              Trommel hinzufügen
            </Button>
          </div>

          <div className="space-y-2">
            {wert.trommeln.map((trommel, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={`Bezeichnung der Trommel ${index + 1}`}
                  className="min-w-40 flex-1"
                  placeholder="Bezeichnung, wie Sie sie bestellen"
                  value={trommel.name}
                  onChange={(event) => setzeTrommel(index, { name: event.target.value })}
                />
                <Input
                  aria-label={`Seilradius der Trommel ${index + 1}`}
                  className="w-28"
                  inputMode="decimal"
                  value={String(trommel.radiusMm)}
                  onChange={(event) =>
                    setzeTrommel(index, { radiusMm: Number(event.target.value.replace(',', '.')) })
                  }
                />
                <span className="text-xs text-slate-500">mm Radius</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setEntwurf({
                      ...wert,
                      trommeln: wert.trommeln.filter((_, i) => i !== index),
                    })
                  }
                >
                  Entfernen
                </Button>
              </div>
            ))}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Der Radius wird <strong>am Seilgrund</strong> gemessen, nicht am Flansch. Zwischen
            beiden liegen bei einer üblichen Trommel gut zwei Zentimeter – das sind über 40 % Irrtum
            im Haltemoment.
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-800">Federreihen</h3>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setEntwurf({
                  ...wert,
                  reihen: [...wert.reihen, { name: '', innenMm: 67, drahtstaerken: [] }],
                })
              }
            >
              Reihe hinzufügen
            </Button>
          </div>

          <div className="space-y-2">
            {wert.reihen.map((reihe, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={`Bezeichnung der Federreihe ${index + 1}`}
                  className="min-w-36 flex-1"
                  placeholder="Bezeichnung"
                  value={reihe.name}
                  onChange={(event) => setzeReihe(index, { name: event.target.value })}
                />
                <Input
                  aria-label={`Innendurchmesser der Federreihe ${index + 1}`}
                  className="w-24"
                  inputMode="decimal"
                  value={String(reihe.innenMm)}
                  onChange={(event) =>
                    setzeReihe(index, { innenMm: Number(event.target.value.replace(',', '.')) })
                  }
                />
                <span className="text-xs text-slate-500">mm innen</span>
                <Input
                  aria-label={`Drahtstärken der Federreihe ${index + 1}`}
                  className="min-w-44 flex-1"
                  placeholder="Drahtstärken, z. B. 4; 4,5; 5 – leer heißt alle"
                  value={reihe.drahtstaerken
                    .map((wert) => String(wert).replace('.', ','))
                    .join('; ')}
                  onChange={(event) =>
                    setzeReihe(index, {
                      // Nur Semikolon und Leerzeichen trennen – das Komma ist
                      // hier das Dezimalzeichen, „4,5" ist eine Stärke und
                      // nicht zwei.
                      drahtstaerken: event.target.value
                        .split(/[;\s]+/)
                        .map((stueck) => Number(stueck.replace(',', '.')))
                        .filter((zahl) => Number.isFinite(zahl) && zahl > 0),
                    })
                  }
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setEntwurf({ ...wert, reihen: wert.reihen.filter((_, i) => i !== index) })
                  }
                >
                  Entfernen
                </Button>
              </div>
            ))}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Sind Drahtstärken hinterlegt, schlägt die Auslegung nur diese vor – dann stehen in der
            Liste nur Federn, die es auch zu kaufen gibt. Das Feld nimmt Komma wie Punkt; getrennt
            wird mit Semikolon oder Leerzeichen.
          </p>
        </div>
      </div>
    </Card>
  );
}

/* Zurücksetzen --------------------------------------------------------- */

interface Umfang {
  kunden: number;
  ansprechpartner: number;
  adressen: number;
  objekte: number;
  anlagen: number;
  pruefungen: number;
  pruefpunkte: number;
  maengel: number;
  serviceberichte: number;
  wartungsvertraege: number;
  angebote: number;
  auftraege: number;
  rechnungen: number;
  zahlungen: number;
  mahnungen: number;
  termine: number;
  projekte: number;
  zeiten: number;
  lagerbewegungen: number;
  dokumente: number;
  postausgang: number;
  protokoll: number;
}

interface Zuruecksetzvorschau {
  loeschen: Umfang;
  bleiben: {
    artikel: number;
    lieferanten: number;
    bestellungen: number;
    mitarbeiter: number;
    zugaenge: number;
    einstellungen: number;
  };
  unberuehrt: { termine: number; projekte: number };
  bestandskorrekturen: number;
  bestaetigungswort: string;
}

interface Zuruecksetzbericht {
  geloescht: Umfang;
  dateien: { entfernt: number; fehlgeschlagen: number };
  bestandskorrekturen: number;
  ungerechneteBuchungen: number;
  nummernkreise: string[];
}

/** Reihenfolge und Beschriftung der Zeilen im Umfang. */
const UMFANG_ZEILEN: Array<[keyof Umfang, string]> = [
  ['kunden', 'Kunden'],
  ['ansprechpartner', 'Ansprechpartner'],
  ['adressen', 'Adressen'],
  ['objekte', 'Objekte'],
  ['anlagen', 'Toranlagen'],
  ['pruefungen', 'Prüfungen'],
  ['pruefpunkte', 'Prüfpunkte'],
  ['maengel', 'Mängel'],
  ['serviceberichte', 'Serviceberichte'],
  ['wartungsvertraege', 'Wartungsverträge'],
  ['angebote', 'Angebote'],
  ['auftraege', 'Aufträge'],
  ['rechnungen', 'Rechnungen'],
  ['zahlungen', 'Zahlungen'],
  ['mahnungen', 'Mahnungen'],
  ['termine', 'Termine'],
  ['projekte', 'Projekte'],
  ['zeiten', 'Zeiterfassungen'],
  ['lagerbewegungen', 'Lagerbewegungen'],
  ['dokumente', 'Dateien'],
  ['postausgang', 'Postausgang'],
  ['protokoll', 'Änderungsprotokoll'],
];

/** „1 Bestellung“ statt „1 Bestellungen“. */
function zahlwort(anzahl: number, eins: string, viele: string): string {
  return `${anzahl} ${anzahl === 1 ? eins : viele}`;
}

/**
 * Betriebsdaten zurücksetzen.
 *
 * Der Übergang von der Erprobung zum Ernstfall. Wer eine Software einführt,
 * probiert sie zuerst an erfundenen Kunden durch – und steht dann vor der
 * Aufgabe, das Probematerial restlos loszuwerden, bevor die ersten echten
 * Daten hineinkommen. Von Hand geht das nicht: Ein Kunde läßt sich nicht
 * löschen, solange eine Rechnung an ihm hängt.
 *
 * Die Karte zeigt vorher jede betroffene Zeile. Das ist der eigentliche
 * Schutz – nicht die Rückfrage, sondern die Zahl davor.
 */
function ZuruecksetzenKarte({ onFertig }: { onFertig: () => void }) {
  const vorschau = useApi<Zuruecksetzvorschau>('/settings/zuruecksetzen');
  const [offen, setOffen] = useState(false);
  const [wort, setWort] = useState('');
  const [nummernkreise, setNummernkreise] = useState(true);
  const [bericht, setBericht] = useState<Zuruecksetzbericht | null>(null);

  const loeschen = useAction(() =>
    api.post<Zuruecksetzbericht>('/settings/zuruecksetzen', {
      bestaetigung: wort.trim(),
      nummernkreise,
    }),
  );

  const daten = vorschau.data;
  const zeilen = daten
    ? UMFANG_ZEILEN.filter(([schluessel]) => daten.loeschen[schluessel] > 0)
    : [];
  const summe = zeilen.reduce((wert, [schluessel]) => wert + (daten?.loeschen[schluessel] ?? 0), 0);
  const wortStimmt = daten ? wort.trim() === daten.bestaetigungswort : false;

  return (
    <Card title="Betriebsdaten zurücksetzen">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Löscht alle Kunden samt ihren Vorgängen – Anlagen, Prüfungen, Mängel, Serviceberichte,
          Angebote, Aufträge, Rechnungen und was daran hängt. Gedacht für den einen Tag, an dem die
          Erprobung endet und die ersten echten Daten hineinsollen.
        </p>

        <p className="text-sm text-slate-600">
          Was dem Betrieb selbst gehört, bleibt: Artikel, Lieferanten, Bestellungen, Mitarbeiter,
          Zugänge und alle Einstellungen.
        </p>

        <p className="meldung-hinweis">
          Das läßt sich nicht rückgängig machen. Laden Sie vorher eine Sicherung herunter – die
          Karte darüber – und legen Sie sie weg. Danach ist sie das einzige, was von diesen Daten
          noch übrig ist.
        </p>

        {vorschau.error ? (
          <ErrorState message={vorschau.error} onRetry={vorschau.reload} />
        ) : vorschau.loading ? (
          <LoadingState />
        ) : daten ? (
          <>
            {summe === 0 ? (
              <p className="meldung-erfolg">Es sind keine Vorgangsdaten vorhanden.</p>
            ) : (
              <div className="rounded border border-slate-200">
                <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                  Das wird gelöscht
                </p>
                <ul className="divide-y divide-slate-100 text-sm">
                  {zeilen.map(([schluessel, beschriftung]) => (
                    <li key={schluessel} className="flex justify-between px-3 py-1.5">
                      <span className="text-slate-700">{beschriftung}</span>
                      <span className="tabular-nums text-slate-900">
                        {daten.loeschen[schluessel]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-slate-500">
              Bleiben stehen: {zahlwort(daten.bleiben.artikel, 'Artikel', 'Artikel')},{' '}
              {zahlwort(daten.bleiben.lieferanten, 'Lieferant', 'Lieferanten')},{' '}
              {zahlwort(daten.bleiben.bestellungen, 'Bestellung', 'Bestellungen')},{' '}
              {zahlwort(daten.bleiben.mitarbeiter, 'Mitarbeiter', 'Mitarbeiter')},{' '}
              {zahlwort(daten.bleiben.zugaenge, 'Zugang', 'Zugänge')},{' '}
              {zahlwort(daten.bleiben.einstellungen, 'Einstellung', 'Einstellungen')}.
              {(daten.unberuehrt.termine > 0 || daten.unberuehrt.projekte > 0) && (
                <>
                  {' '}
                  Ebenfalls unberührt: {zahlwort(
                    daten.unberuehrt.termine,
                    'Termin',
                    'Termine',
                  )} und {zahlwort(daten.unberuehrt.projekte, 'Projekt', 'Projekte')} ohne
                  Kundenbezug – die gehören zu keinem Vorgang.
                </>
              )}
              {daten.bestandskorrekturen > 0 && (
                <>
                  {' '}
                  Bei {zahlwort(daten.bestandskorrekturen, 'Artikel', 'Artikeln')} wird das Material
                  zurückgebucht, das ein gelöschter Servicebericht aus dem Lager genommen hatte.
                </>
              )}
            </p>
          </>
        ) : null}

        {!offen ? (
          <Button variant="danger" disabled={summe === 0} onClick={() => setOffen(true)}>
            Zurücksetzen …
          </Button>
        ) : (
          <div className="space-y-3 rounded border border-fehler/30 bg-fehler/5 p-4">
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-300"
                checked={nummernkreise}
                onChange={(event) => setNummernkreise(event.target.checked)}
              />
              <span>
                Belegnummern wieder bei 1 beginnen
                <span className="block text-xs text-slate-500">
                  Sonst trägt Ihre erste echte Rechnung die Nummer, die auf die letzte Probe folgt.
                  Betrifft nur die Belegarten, deren Belege hier verschwinden – Lieferanten,
                  Artikel, Mitarbeiter und Bestellungen behalten ihre Nummern.
                </span>
              </span>
            </label>

            <Field
              label={`Zum Bestätigen „${daten?.bestaetigungswort ?? ''}“ eintippen`}
              htmlFor="zuruecksetzen-wort"
              required
            >
              <Input
                id="zuruecksetzen-wort"
                value={wort}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setWort(event.target.value)}
              />
            </Field>

            {loeschen.error && <ErrorState message={loeschen.error} />}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                loading={loeschen.loading}
                disabled={!wortStimmt}
                onClick={async () => {
                  const ergebnis = await loeschen.run();
                  if (!ergebnis) return;
                  setBericht(ergebnis);
                  setOffen(false);
                  setWort('');
                  vorschau.reload();
                  onFertig();
                }}
              >
                Endgültig zurücksetzen
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setOffen(false);
                  setWort('');
                }}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}

        {bericht && (
          <div className="meldung-erfolg">
            <p>
              Zurückgesetzt: {zahlwort(bericht.geloescht.kunden, 'Kunde', 'Kunden')},{' '}
              {zahlwort(bericht.geloescht.anlagen, 'Toranlage', 'Toranlagen')},{' '}
              {zahlwort(bericht.geloescht.pruefungen, 'Prüfung', 'Prüfungen')},{' '}
              {zahlwort(bericht.geloescht.serviceberichte, 'Servicebericht', 'Serviceberichte')},{' '}
              {zahlwort(bericht.geloescht.angebote, 'Angebot', 'Angebote')},{' '}
              {zahlwort(bericht.geloescht.auftraege, 'Auftrag', 'Aufträge')},{' '}
              {zahlwort(bericht.geloescht.rechnungen, 'Rechnung', 'Rechnungen')}.
            </p>
            <p className="mt-1 text-xs">
              {zahlwort(bericht.dateien.entfernt, 'Datei', 'Dateien')} aus der Ablage entfernt
              {bericht.dateien.fehlgeschlagen > 0 &&
                `, ${bericht.dateien.fehlgeschlagen} nicht erreichbar`}
              .
              {bericht.bestandskorrekturen > 0 &&
                ` Bei ${zahlwort(bericht.bestandskorrekturen, 'Artikel', 'Artikeln')} wurde der Bestand zurückgebucht.`}
              {bericht.ungerechneteBuchungen > 0 &&
                ` ${zahlwort(bericht.ungerechneteBuchungen, 'Lagerbuchung ließ', 'Lagerbuchungen ließen')} sich nicht zurückrechnen – bitte den Bestand dieser Artikel prüfen.`}
              {bericht.nummernkreise.length > 0 && ' Die Belegnummern beginnen wieder bei 1.'}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

/* Nummernkreise -------------------------------------------------------- */

function NummernkreiseKarte({ ranges }: { ranges: ReturnType<typeof useApi<NumberRange[]>> }) {
  const [drafts, setDrafts] = useState<Record<string, { prefix: string; padding: string }>>({});
  const save = useAction((input: { entity: string; body: Record<string, unknown> }) =>
    api.patch(`/settings/number-ranges/${input.entity}`, input.body),
  );

  return (
    <Card title="Nummernkreise" bodyClassName="">
      {save.error && (
        <div className="card-body">
          <ErrorState message={save.error} />
        </div>
      )}
      {ranges.error ? (
        <div className="p-5">
          <ErrorState message={ranges.error} onRetry={ranges.reload} />
        </div>
      ) : ranges.loading ? (
        <LoadingState />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Belegart</th>
              <th>Präfix</th>
              <th className="text-right">Stellen</th>
              <th className="text-right">Nächste Nummer</th>
              <th>Jahresreset</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(ranges.data ?? []).map((range) => {
              const draft = drafts[range.entity] ?? {
                prefix: range.prefix,
                padding: String(range.padding),
              };
              const changed =
                draft.prefix !== range.prefix || Number(draft.padding) !== range.padding;

              return (
                <tr key={range.entity}>
                  <td className="text-slate-900">
                    {ENTITY_LABELS[range.entity] ?? range.entity}
                    {!range.konfiguriert && (
                      <Badge tone="neutral" className="ml-2">
                        Vorgabe
                      </Badge>
                    )}
                  </td>
                  <td>
                    <Input
                      value={draft.prefix}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [range.entity]: { ...draft, prefix: event.target.value },
                        }))
                      }
                      className="w-24"
                      aria-label={`Präfix ${range.entity}`}
                    />
                  </td>
                  <td className="text-right">
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={draft.padding}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [range.entity]: { ...draft, padding: event.target.value },
                        }))
                      }
                      className="w-20"
                      aria-label={`Stellen ${range.entity}`}
                    />
                  </td>
                  <td className="tabular text-right font-medium">{range.nextNumber}</td>
                  <td>
                    <Badge tone={range.yearlyReset ? 'info' : 'neutral'}>
                      {range.yearlyReset ? 'jährlich' : 'fortlaufend'}
                    </Badge>
                  </td>
                  <td className="text-right">
                    {changed && (
                      <Button
                        size="sm"
                        loading={save.loading}
                        onClick={async () => {
                          const result = await save.run({
                            entity: range.entity,
                            body: { prefix: draft.prefix, padding: Number(draft.padding) },
                          });
                          if (result) ranges.reload();
                        }}
                      >
                        Speichern
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
        Der Zähler kann nicht unter den bereits erreichten Wert gesetzt werden, damit keine
        Belegnummer doppelt vergeben wird.
      </p>
    </Card>
  );
}
