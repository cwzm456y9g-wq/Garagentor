'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Table,
} from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction, useApi } from '@/lib/hooks';
import type { NumberRange, Setting } from '@/lib/types';

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

export default function SettingsPage() {
  const settings = useApi<Setting[]>('/settings');
  const ranges = useApi<NumberRange[]>('/settings/number-ranges');
  const [drafts, setDrafts] = useState<Record<string, { prefix: string; padding: string }>>({});

  const save = useAction((input: { entity: string; body: Record<string, unknown> }) =>
    api.patch(`/settings/number-ranges/${input.entity}`, input.body),
  );

  const company = settings.data?.find((setting) => setting.key === 'firma')?.value as
    Record<string, string> | undefined;
  const dunning = settings.data?.find((setting) => setting.key === 'mahnwesen')?.value as
    | {
        stufen?: Array<{
          level: string;
          daysOverdue: number;
          fee: number;
          interestPercent: number;
        }>;
      }
    | undefined;
  const inspection = settings.data?.find((setting) => setting.key === 'pruefung')?.value as
    | { intervalMonths?: number; reminderDaysBefore?: number; requireQualifiedInspector?: boolean }
    | undefined;

  return (
    <>
      <PageHeader
        title="Einstellungen"
        subtitle="Firmendaten, Nummernkreise, Mahnstufen und Prüfvorgaben"
      />

      {save.error && (
        <div className="mb-4">
          <ErrorState message={save.error} />
        </div>
      )}

      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Firmendaten">
            {settings.loading ? (
              <LoadingState />
            ) : company ? (
              <dl className="space-y-2 text-sm">
                <Row label="Firma" value={company.name} />
                <Row
                  label="Anschrift"
                  value={`${company.street}, ${company.zip} ${company.city}`}
                />
                <Row label="Telefon" value={company.phone} />
                <Row label="E-Mail" value={company.email} />
                <Row label="USt-IdNr." value={company.vatId} />
                <Row label="Steuernummer" value={company.taxNumber} />
                <Row label="Geschäftsführung" value={company.managingDirector} />
                <Row label="Registergericht" value={company.registerCourt} />
                <Row label="Handelsregister" value={company.registerNumber} />
                <Row label="Bank" value={company.bankName} />
                <Row label="IBAN" value={company.iban} />
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Keine Firmendaten hinterlegt.</p>
            )}
          </Card>

          <div className="space-y-6">
            <Card title="Prüfvorgaben nach ASR A1.7">
              {inspection ? (
                <dl className="space-y-2 text-sm">
                  <Row label="Prüfintervall" value={`${inspection.intervalMonths ?? 12} Monate`} />
                  <Row
                    label="Vorlauf für Erinnerung"
                    value={`${inspection.reminderDaysBefore ?? 30} Tage`}
                  />
                  <Row
                    label="Sachkunde erforderlich"
                    value={inspection.requireQualifiedInspector === false ? 'nein' : 'ja'}
                  />
                </dl>
              ) : (
                <p className="text-sm text-slate-500">Es gelten die Vorgabewerte.</p>
              )}
              <p className="mt-3 text-xs text-slate-500">
                Kraftbetätigte Tore sind nach ASR A1.7 Abschnitt 10 mindestens jährlich durch eine
                sachkundige Person zu prüfen.
              </p>
            </Card>

            <Card title="Mahnstufen" bodyClassName="">
              {(dunning?.stufen ?? []).length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-500">Es gelten die Vorgabewerte.</p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>Stufe</th>
                      <th className="text-right">ab Verzug</th>
                      <th className="text-right">Gebühr</th>
                      <th className="text-right">Zinssatz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dunning?.stufen ?? []).map((stufe) => (
                      <tr key={stufe.level}>
                        <td className="text-slate-900">{stufe.level}</td>
                        <td className="tabular text-right text-slate-600">
                          {stufe.daysOverdue} Tage
                        </td>
                        <td className="tabular text-right text-slate-600">{stufe.fee} €</td>
                        <td className="tabular text-right text-slate-600">
                          {stufe.interestPercent} %
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>
        </div>

        <Card title="Nummernkreise" bodyClassName="">
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
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right text-slate-900">{value ?? '–'}</dd>
    </div>
  );
}
