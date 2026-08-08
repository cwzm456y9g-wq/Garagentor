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
  PageHeader,
  Select,
  Table,
  Textarea,
} from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction, useApi } from '@/lib/hooks';
import type {
  CompanySettings,
  DocumentSettings,
  DunningLevelSetting,
  InspectionSettings,
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
            geladen={wertVon<{ stufen?: DunningLevelSetting[] }>('mahnwesen')?.stufen ?? []}
            neuLaden={settings.reload}
          />
          <PruefungKarte
            geladen={wertVon<InspectionSettings>('pruefung') ?? {}}
            neuLaden={settings.reload}
          />
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
              className="text-marine-700 hover:underline"
            >
              einsetzen
            </button>
            <button
              type="button"
              onClick={async () => {
                if (await entfernen.run(vorlage.id)) vorlagen.reload();
              }}
              className="px-1 text-slate-400 hover:text-red-600"
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

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Umsatzsteuersatz" htmlFor="belege-ust" hint="Vorbelegung neuer Positionen.">
            <Select
              id="belege-ust"
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

function MahnwesenKarte({
  geladen,
  neuLaden,
}: {
  geladen: DunningLevelSetting[];
  neuLaden: () => void;
}) {
  const [entwurf, setEntwurf] = useState<DunningLevelSetting[] | null>(null);
  const wert = entwurf ?? geladen;
  const geaendert = entwurf !== null && JSON.stringify(entwurf) !== JSON.stringify(geladen);

  const speichern = useAction((stufen: DunningLevelSetting[]) =>
    api.put('/settings/mahnwesen', { value: { stufen }, category: 'mahnwesen' }),
  );

  const setzen = (index: number, feld: keyof DunningLevelSetting, neu: number) =>
    setEntwurf(wert.map((stufe, i) => (i === index ? { ...stufe, [feld]: neu } : stufe)));

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

      {wert.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">Es gelten die Vorgabewerte.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Stufe</th>
              <th className="text-right">ab Verzug (Tage)</th>
              <th className="text-right">Gebühr (€)</th>
              <th className="text-right">Zinssatz (%)</th>
              <th className="text-right">Nachfrist (Tage)</th>
            </tr>
          </thead>
          <tbody>
            {wert.map((stufe, index) => (
              <tr key={stufe.level}>
                <td className="font-medium text-slate-900">
                  {DUNNING_LABELS[stufe.level] ?? stufe.level}
                </td>
                {(
                  [
                    ['daysOverdue', 0, 365],
                    ['fee', 0, 999],
                    ['interestPercent', 0, 30],
                    ['graceDays', 0, 90],
                  ] as Array<[keyof DunningLevelSetting, number, number]>
                ).map(([feld, min, max]) => (
                  <td key={feld} className="text-right">
                    <Input
                      type="number"
                      min={min}
                      max={max}
                      step={feld === 'fee' || feld === 'interestPercent' ? 0.5 : 1}
                      value={stufe[feld]}
                      onChange={(event) => setzen(index, feld, Number(event.target.value))}
                      className="w-24 text-right"
                      aria-label={`${feld} ${stufe.level}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
        Der Zinssatz nach § 288 BGB liegt bei Verbrauchern fünf, bei Unternehmen neun Prozentpunkte
        über dem Basiszinssatz. Wird derzeit einheitlich angewandt.
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
