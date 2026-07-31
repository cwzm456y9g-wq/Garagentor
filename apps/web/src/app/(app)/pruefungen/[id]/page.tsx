'use client';

import {
  checkResultLabels,
  formatDate,
  formatNumber,
  inspectionTypeLabels,
  type CheckResult,
} from '@garagentor/shared';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
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
} from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction, useApi } from '@/lib/hooks';
import { defectSeverity, inspectionResult } from '@/lib/status';
import type { Inspection, InspectionCheck } from '@/lib/types';

/** Eingabestand eines Prüfpunkts vor dem Speichern. */
interface CheckDraft {
  result: CheckResult;
  measuredValue: string;
  comment: string;
}

export default function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<Inspection>(`/inspections/${id}`);
  const [drafts, setDrafts] = useState<Record<string, CheckDraft>>({});
  const [signedByName, setSignedByName] = useState('');

  // Der Eingabestand wird aus dem geladenen Protokoll vorbelegt.
  useEffect(() => {
    if (!data?.checks) return;
    setDrafts(
      Object.fromEntries(
        data.checks.map((check) => [
          check.key,
          {
            result: check.result,
            measuredValue: check.measuredValue?.toString() ?? '',
            comment: check.comment ?? '',
          },
        ]),
      ),
    );
  }, [data]);

  const save = useAction((checks: unknown[]) => api.patch(`/inspections/${id}/checks`, { checks }));
  const complete = useAction((body: Record<string, unknown>) =>
    api.post(`/inspections/${id}/complete`, body),
  );

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState />;

  const checks = data.checks ?? [];
  const done = checks.filter((check) => drafts[check.key]?.result !== 'NICHT_GEPRUEFT').length;
  const defects = checks.filter((check) => drafts[check.key]?.result === 'MANGEL').length;
  const closed = Boolean(data.completedAt);
  const result = inspectionResult(data.result);

  // Prüfpunkte werden nach den Gruppen des Katalogs gegliedert.
  const groups = checks.reduce<Record<string, InspectionCheck[]>>((acc, check) => {
    (acc[check.group] ??= []).push(check);
    return acc;
  }, {});

  function setDraft(key: string, patch: Partial<CheckDraft>) {
    setDrafts((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  async function saveChecks() {
    const payload = checks
      .filter((check) => drafts[check.key])
      .map((check) => ({
        key: check.key,
        result: drafts[check.key].result,
        measuredValue: drafts[check.key].measuredValue
          ? Number(drafts[check.key].measuredValue)
          : undefined,
        comment: drafts[check.key].comment || undefined,
      }));

    if (await save.run(payload)) reload();
  }

  return (
    <>
      <PageHeader
        title={`Prüfprotokoll ${data.inspectionNumber}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{inspectionTypeLabels[data.type]} nach ASR A1.7</span>
            <span>· {formatDate(data.date)}</span>
            <span>· {data.inspectorName}</span>
            {closed ? (
              <Badge tone={result.tone}>{result.label}</Badge>
            ) : (
              <Badge tone="warning">in Bearbeitung</Badge>
            )}
          </span>
        }
        actions={
          !closed && (
            <>
              <Button variant="secondary" loading={save.loading} onClick={() => void saveChecks()}>
                Zwischenstand speichern
              </Button>
              <Button
                loading={complete.loading}
                disabled={done < checks.length}
                onClick={async () => {
                  await saveChecks();
                  if (await complete.run({ signedByName: signedByName || undefined })) reload();
                }}
              >
                Prüfung abschließen
              </Button>
            </>
          )
        }
      />

      {(save.error ?? complete.error) && (
        <div className="mb-4">
          <ErrorState message={(save.error ?? complete.error)!} />
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Fortschritt</p>
          <p className="tabular mt-1 text-2xl font-semibold text-slate-900">
            {done} / {checks.length}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="bg-marine-600 h-full rounded-full transition-all"
              style={{ width: `${checks.length ? (done / checks.length) * 100 : 0}%` }}
            />
          </div>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Beanstandungen
          </p>
          <p className="tabular mt-1 text-2xl font-semibold text-slate-900">{defects}</p>
          <p className="mt-1 text-xs text-slate-500">Prüfpunkte mit Mangel</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Anlage</p>
          {data.door && (
            <Link
              href={`/tore/${data.door.id}`}
              className="text-marine-700 mt-1 block font-medium hover:underline"
            >
              {data.door.doorNumber}
            </Link>
          )}
          <p className="mt-0.5 text-xs text-slate-500">{data.door?.location}</p>
        </Card>
      </div>

      {closed && (
        <Card title="Ergebnis" className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={result.tone}>{result.label}</Badge>
            <span className="text-sm text-slate-600">
              Nächste Prüfung: {formatDate(data.nextDueDate)}
            </span>
          </div>
          {data.summary && <p className="mt-3 text-sm text-slate-700">{data.summary}</p>}
          {data.signedByName && (
            <p className="mt-2 text-xs text-slate-500">Gegengezeichnet von {data.signedByName}</p>
          )}
          {(data.defects ?? []).length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              {(data.defects ?? []).map((defect) => {
                const severity = defectSeverity(defect.severity);
                return (
                  <li key={defect.id} className="flex items-start gap-2 text-sm">
                    <Badge tone={severity.tone}>{severity.label}</Badge>
                    <span className="text-slate-700">{defect.title}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <div className="space-y-6">
        {Object.entries(groups).map(([group, items]) => (
          <Card key={group} title={group} bodyClassName="">
            <ul className="divide-y divide-slate-100">
              {items.map((check) => {
                const draft = drafts[check.key] ?? {
                  result: check.result,
                  measuredValue: '',
                  comment: '',
                };
                const exceeded =
                  check.limitValue != null &&
                  draft.measuredValue !== '' &&
                  Number(draft.measuredValue) > check.limitValue;

                return (
                  <li key={check.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          <span className="tabular mr-2 text-slate-400">{check.position}.</span>
                          {check.label}
                        </p>
                        {check.reference && (
                          <p className="mt-0.5 text-xs text-slate-500">{check.reference}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {check.limitValue != null && (
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              step="0.01"
                              value={draft.measuredValue}
                              onChange={(event) =>
                                setDraft(check.key, { measuredValue: event.target.value })
                              }
                              disabled={closed}
                              className="w-28"
                              placeholder="Messwert"
                              aria-label={`Messwert ${check.label}`}
                            />
                            <span className="whitespace-nowrap text-xs text-slate-500">
                              {check.unit} (max. {formatNumber(check.limitValue, 0)})
                            </span>
                          </div>
                        )}

                        <Select
                          value={draft.result}
                          onChange={(event) =>
                            setDraft(check.key, { result: event.target.value as CheckResult })
                          }
                          disabled={closed}
                          className="w-44"
                          aria-label={`Ergebnis ${check.label}`}
                        >
                          {Object.entries(checkResultLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {exceeded && (
                      <p className="mt-2 text-xs font-medium text-red-700">
                        Der Messwert überschreitet den Grenzwert – der Prüfpunkt wird beim Speichern
                        als Mangel gewertet.
                      </p>
                    )}

                    {(draft.result === 'MANGEL' || draft.comment) && (
                      <Input
                        value={draft.comment}
                        onChange={(event) => setDraft(check.key, { comment: event.target.value })}
                        disabled={closed}
                        placeholder="Bemerkung zum Prüfpunkt"
                        aria-label={`Bemerkung ${check.label}`}
                        className="mt-2"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      {!closed && (
        <Card title="Abschluss" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Gegenzeichnung durch"
              htmlFor="signedByName"
              hint="Name der Person, die das Protokoll beim Kunden bestätigt."
            >
              <Input
                id="signedByName"
                value={signedByName}
                onChange={(event) => setSignedByName(event.target.value)}
              />
            </Field>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Der Abschluss setzt ein Ergebnis zu jedem Prüfpunkt voraus. Beanstandungen werden
            automatisch als Mängel mit Frist angelegt; sicherheitsrelevante Punkte führen zur
            Stilllegung der Anlage.
          </p>
        </Card>
      )}
    </>
  );
}
