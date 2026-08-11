'use client';

import { employmentTypeLabels, formatDate, formatNumber } from '@garagentor/shared';
import Link from 'next/link';
import { use, useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LinkButton,
  LoadingState,
  PageHeader,
  Table,
} from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction, useApi } from '@/lib/hooks';
import type { Employee, Qualification } from '@/lib/types';

/** Leer, sobald die Eingabe abgeschickt wurde. */
const LEER = {
  name: '',
  issuer: '',
  certificate: '',
  issuedAt: '',
  expiresAt: '',
  qualifiesForInspection: false,
};

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<Employee>(`/employees/${id}`);
  const [nachweis, setNachweis] = useState(LEER);
  const [offen, setOffen] = useState(false);

  const anlegen = useAction((body: Record<string, unknown>) =>
    api.post(`/employees/${id}/qualifications`, body),
  );
  const entfernen = useAction((qualificationId: string) =>
    api.delete(`/employees/${id}/qualifications/${qualificationId}`),
  );

  async function nachweisAnlegen(event: FormEvent) {
    event.preventDefault();

    const ergebnis = await anlegen.run({
      name: nachweis.name,
      issuer: nachweis.issuer || undefined,
      certificate: nachweis.certificate || undefined,
      issuedAt: nachweis.issuedAt || undefined,
      expiresAt: nachweis.expiresAt || undefined,
      qualifiesForInspection: nachweis.qualifiesForInspection,
    });

    if (ergebnis) {
      setNachweis(LEER);
      setOffen(false);
      reload();
    }
  }

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState />;

  const sachkundig = (data.qualifications ?? []).some(
    (nachweis) => nachweis.qualifiesForInspection && !nachweis.expired,
  );

  return (
    <>
      <PageHeader
        title={`${data.firstName} ${data.lastName}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{data.employeeNumber}</span>
            {data.position && <span>· {data.position}</span>}
            <span>· {employmentTypeLabels[data.employmentType]}</span>
            {!data.active && <Badge tone="neutral">Ausgetreten</Badge>}
            {sachkundig ? (
              <Badge tone="success">Sachkundig nach ASR A1.7</Badge>
            ) : (
              <Badge tone="warning">Keine gültige Sachkunde</Badge>
            )}
          </span>
        }
        actions={<LinkButton href={`/personal/${id}/bearbeiten`}>Bearbeiten</LinkButton>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Stammdaten" className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
            <Zeile begriff="Eintritt" wert={formatDate(data.hireDate)} />
            {data.exitDate && <Zeile begriff="Austritt" wert={formatDate(data.exitDate)} />}
            <Zeile begriff="Wochenstunden" wert={formatNumber(data.weeklyHours)} />
            <Zeile begriff="Urlaubstage" wert={String(data.vacationDays)} />
            {data.email && <Zeile begriff="E-Mail" wert={data.email} />}
            {data.phone && <Zeile begriff="Telefon" wert={data.phone} />}
            {data.mobile && <Zeile begriff="Mobil" wert={data.mobile} />}
            {data.user && (
              <Zeile begriff="Zugang" wert={`${data.user.email} · ${data.user.role}`} />
            )}
          </dl>
        </Card>

        <Card
          title="Qualifikationen"
          className="lg:col-span-2"
          bodyClassName=""
          actions={
            <Button size="sm" variant="secondary" onClick={() => setOffen((auf) => !auf)}>
              {offen ? 'Abbrechen' : 'Nachweis hinzufügen'}
            </Button>
          }
        >
          {offen && (
            <form onSubmit={nachweisAnlegen} className="space-y-4 border-b border-slate-100 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Bezeichnung"
                  htmlFor="q-name"
                  required
                  hint="Etwa „Sachkundiger für kraftbetätigte Tore (DGUV 208-022)“."
                >
                  <Input
                    id="q-name"
                    value={nachweis.name}
                    onChange={(e) => setNachweis({ ...nachweis, name: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Ausgestellt von" htmlFor="q-issuer">
                  <Input
                    id="q-issuer"
                    value={nachweis.issuer}
                    onChange={(e) => setNachweis({ ...nachweis, issuer: e.target.value })}
                  />
                </Field>
                <Field label="Urkundennummer" htmlFor="q-certificate">
                  <Input
                    id="q-certificate"
                    value={nachweis.certificate}
                    onChange={(e) => setNachweis({ ...nachweis, certificate: e.target.value })}
                  />
                </Field>
                <Field label="Ausgestellt am" htmlFor="q-issuedAt">
                  <Input
                    id="q-issuedAt"
                    type="date"
                    value={nachweis.issuedAt}
                    onChange={(e) => setNachweis({ ...nachweis, issuedAt: e.target.value })}
                  />
                </Field>
                <Field
                  label="Gültig bis"
                  htmlFor="q-expiresAt"
                  hint="Leer lassen, wenn der Nachweis unbefristet gilt."
                >
                  <Input
                    id="q-expiresAt"
                    type="date"
                    value={nachweis.expiresAt}
                    onChange={(e) => setNachweis({ ...nachweis, expiresAt: e.target.value })}
                  />
                </Field>
              </div>

              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-300"
                  checked={nachweis.qualifiesForInspection}
                  onChange={(e) =>
                    setNachweis({ ...nachweis, qualifiesForInspection: e.target.checked })
                  }
                />
                <span>
                  Berechtigt zur Prüfung nach ASR A1.7
                  <span className="block text-xs text-slate-500">
                    Nur wer das hat, erscheint bei einer Prüfung in der Auswahl der prüfenden Person
                    – und darf das Protokoll unterschreiben.
                  </span>
                </span>
              </label>

              {anlegen.error && <ErrorState message={anlegen.error} />}

              <Button type="submit" size="sm" loading={anlegen.loading}>
                Nachweis speichern
              </Button>
            </form>
          )}

          {(data.qualifications ?? []).length === 0 ? (
            <EmptyState
              title="Kein Nachweis hinterlegt"
              description="Ohne Sachkundenachweis kann diese Person keine Prüfung nach ASR A1.7 durchführen."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Nachweis</th>
                  <th>Aussteller</th>
                  <th>Gültig bis</th>
                  <th>ASR A1.7</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(data.qualifications ?? []).map((nachweis) => (
                  <tr key={nachweis.id}>
                    <td className="font-medium text-slate-900">
                      {nachweis.name}
                      {nachweis.certificate && (
                        <span className="block text-xs text-slate-500">
                          Nr. {nachweis.certificate}
                        </span>
                      )}
                    </td>
                    <td className="text-slate-700">{nachweis.issuer ?? '–'}</td>
                    <td>{<Gueltigkeit nachweis={nachweis} />}</td>
                    <td>
                      {nachweis.qualifiesForInspection ? (
                        <Badge tone="success">ja</Badge>
                      ) : (
                        <span className="text-xs text-slate-500">–</span>
                      )}
                    </td>
                    <td className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (await entfernen.run(nachweis.id)) reload();
                        }}
                      >
                        Entfernen
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      {entfernen.error && (
        <div className="mt-4">
          <ErrorState message={entfernen.error} />
        </div>
      )}

      <p className="mt-6 text-sm text-slate-500">
        <Link href="/personal" className="text-verweis hover:underline">
          ← Zurück zur Übersicht
        </Link>
      </p>
    </>
  );
}

function Zeile({ begriff, wert }: { begriff: string; wert: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{begriff}</dt>
      <dd className="text-right text-slate-900">{wert}</dd>
    </div>
  );
}

/** Unbefristet, gültig oder abgelaufen – der Unterschied entscheidet über die Einteilung. */
function Gueltigkeit({ nachweis }: { nachweis: Qualification }) {
  if (!nachweis.expiresAt) return <span className="text-xs text-slate-500">unbefristet</span>;
  if (nachweis.expired) return <Badge tone="danger">abgelaufen</Badge>;

  const tage = nachweis.daysUntilExpiry;
  return (
    <Badge tone={tage !== null && tage !== undefined && tage <= 90 ? 'warning' : 'neutral'}>
      {formatDate(nachweis.expiresAt)}
    </Badge>
  );
}
