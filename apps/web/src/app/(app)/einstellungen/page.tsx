'use client';

import { useRef, useState } from 'react';
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
  PRUEFPROTOKOLL: 'Prüfprotokoll',
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
          <NummernkreiseKarte ranges={ranges} />
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

        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Die Zugangsdaten des Mailservers stehen bewusst nicht hier, sondern als MAIL_HOST,
          MAIL_PORT, MAIL_USER, MAIL_PASSWORD und MAIL_FROM in der Umgebung des Servers. So landen
          sie weder in der Datenbank noch in einer Sicherung, die weitergereicht wird.
        </p>

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
