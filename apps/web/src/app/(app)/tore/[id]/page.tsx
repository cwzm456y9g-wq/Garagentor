'use client';

import {
  customerDisplayName,
  doorTypeLabels,
  formatDate,
  formatNumber,
  inspectionTypeLabels,
  operationModeLabels,
} from '@garagentor/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EntfernenKnopf } from '@/components/entfernen';
import { use } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  LinkButton,
  PageHeader,
  Table,
} from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useAction, useApi } from '@/lib/hooks';
import { defectSeverity, defectStatus, doorStatus, inspectionResult } from '@/lib/status';
import type { Door } from '@/lib/types';

export default function DoorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi<Door>(`/doors/${id}`);
  const resolve = useAction((defectId: string) => api.post(`/defects/${defectId}/resolve`, {}));

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState />;

  const status = doorStatus(data.status);
  const openInspection = data.inspections?.find((inspection) => !inspection.completedAt);

  return (
    <>
      <PageHeader
        title={`${data.doorNumber} · ${data.location}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{doorTypeLabels[data.type]}</span>
            <span>· {operationModeLabels[data.operationMode]}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
            {data.inspectionOverdue && <Badge tone="danger">Prüfung überfällig</Badge>}
          </span>
        }
        actions={
          <>
            <LinkButton href={`/serviceberichte/neu?tor=${data.id}`} variant="secondary">
              Servicebericht
            </LinkButton>
            {/*
              Gewicht und Höhe stehen an der Anlage – der Rechner soll sie
              nicht noch einmal abfragen. Fehlt eines, bleibt sein Feld auf
              dem Vorgabewert.
            */}
            <LinkButton
              href={`/federn?${new URLSearchParams({
                ...(data.weightKg ? { gewicht: String(data.weightKg) } : {}),
                ...(data.heightMm ? { hoehe: String(data.heightMm) } : {}),
              })}`}
              variant="secondary"
            >
              Federrechner
            </LinkButton>
            <LinkButton href={`/tore/${data.id}/bearbeiten`} variant="secondary">
              Bearbeiten
            </LinkButton>
            <EntfernenKnopf
              pfad={`/doors/${data.id}`}
              titel={`Toranlage ${data.doorNumber} entfernen`}
              beschreibung={
                <>
                  Die Anlage wird mitsamt ihren Prüfprotokollen, Mängeln und Serviceberichten
                  entfernt. Hängt sie an einem Wartungsvertrag, fällt sie dort heraus. Rechnungen
                  bleiben unberührt – die stehen für sich.
                </>
              }
              onEntfernt={() => router.push('/tore')}
            />
            {data.operationMode === 'KRAFTBETAETIGT' &&
              (openInspection ? (
                <Button onClick={() => router.push(`/pruefungen/${openInspection.id}`)}>
                  Offene Prüfung fortsetzen
                </Button>
              ) : (
                <LinkButton href={`/pruefungen/neu?tor=${data.id}`}>
                  Prüfung nach ASR A1.7
                </LinkButton>
              ))}
          </>
        }
      />

      {resolve.error && (
        <div className="mb-4">
          <ErrorState message={resolve.error} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title="Anlage">
            <dl className="space-y-2 text-sm">
              <Row label="Hersteller" value={data.manufacturer ?? '–'} />
              <Row label="Modell" value={data.model ?? '–'} />
              <Row label="Seriennummer" value={data.serialNumber ?? '–'} />
              <Row label="Baujahr" value={data.yearBuilt ? String(data.yearBuilt) : '–'} />
              <Row
                label="Maße (B × H)"
                value={
                  data.widthMm && data.heightMm
                    ? `${formatNumber(data.widthMm, 0)} × ${formatNumber(data.heightMm, 0)} mm`
                    : '–'
                }
              />
              <Row
                label="Torblattgewicht"
                value={data.weightKg ? `${formatNumber(data.weightKg, 1)} kg` : '–'}
              />
              <Row label="Einbau" value={formatDate(data.installationDate)} />
              <Row label="Gewährleistung bis" value={formatDate(data.warrantyUntil)} />
            </dl>
          </Card>

          <Card title="Antrieb">
            <dl className="space-y-2 text-sm">
              <Row label="Hersteller" value={data.driveManufacturer ?? '–'} />
              <Row label="Modell" value={data.driveModel ?? '–'} />
              <Row label="Betriebsart" value={operationModeLabels[data.operationMode]} />
            </dl>
          </Card>

          <Card title="Prüffrist">
            {data.operationMode === 'KRAFTBETAETIGT' ? (
              <>
                <p className="tabular text-lg font-semibold text-slate-900">
                  {formatDate(data.nextInspectionDue)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {data.inspectionOverdue
                    ? 'Die Prüfung ist überfällig.'
                    : data.daysUntilInspection != null
                      ? `Noch ${data.daysUntilInspection} Tage.`
                      : 'Noch keine Prüfung erfolgt.'}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Kraftbetätigte Tore sind nach ASR A1.7 Abschnitt 10 mindestens jährlich durch eine
                  sachkundige Person zu prüfen.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-600">
                Handbetätigte Anlagen unterliegen nicht der wiederkehrenden Prüfpflicht für
                kraftbetätigte Tore.
              </p>
            )}
          </Card>

          <Card title="Zuordnung">
            {data.customer && (
              <>
                <Link
                  href={`/kunden/${data.customer.id}`}
                  className="text-verweis font-medium hover:underline"
                >
                  {customerDisplayName(data.customer)}
                </Link>
                <p className="tabular mt-0.5 text-sm text-slate-500">
                  {data.customer.customerNumber}
                </p>
              </>
            )}
            {data.site && (
              <p className="mt-3 text-sm text-slate-600">
                {data.site.name}
                <span className="block text-xs">
                  {data.site.street}, {data.site.zip} {data.site.city}
                </span>
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card title="Offene Mängel" bodyClassName="">
            {(data.defects ?? []).length === 0 ? (
              <EmptyState title="Keine offenen Mängel" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Mangel</th>
                    <th>Schweregrad</th>
                    <th>Frist</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(data.defects ?? []).map((defect) => {
                    const severity = defectSeverity(defect.severity);
                    const state = defectStatus(defect.status);
                    return (
                      <tr key={defect.id}>
                        <td>
                          <span className="font-medium text-slate-900">{defect.title}</span>
                          {defect.description && (
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {defect.description}
                            </span>
                          )}
                        </td>
                        <td>
                          <Badge tone={severity.tone}>{severity.label}</Badge>
                        </td>
                        <td className="tabular whitespace-nowrap text-slate-600">
                          {formatDate(defect.dueDate)}
                        </td>
                        <td>
                          <Badge tone={state.tone}>{state.label}</Badge>
                        </td>
                        <td className="text-right">
                          {user && defect.status !== 'BEHOBEN' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={async () => {
                                if (await resolve.run(defect.id)) reload();
                              }}
                            >
                              Behoben
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Prüfhistorie" bodyClassName="">
            {(data.inspections ?? []).length === 0 ? (
              <EmptyState title="Noch keine Prüfung erfasst" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Protokoll</th>
                    <th>Datum</th>
                    <th>Art</th>
                    <th>Prüfende Person</th>
                    <th>Ergebnis</th>
                    <th>Nächste Frist</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.inspections ?? []).map((inspection) => {
                    const result = inspectionResult(inspection.result);
                    return (
                      <tr key={inspection.id}>
                        <td className="tabular">
                          <Link
                            href={`/pruefungen/${inspection.id}`}
                            className="text-verweis font-medium hover:underline"
                          >
                            {inspection.inspectionNumber}
                          </Link>
                        </td>
                        <td className="tabular whitespace-nowrap text-slate-600">
                          {formatDate(inspection.date)}
                        </td>
                        <td className="text-slate-600">{inspectionTypeLabels[inspection.type]}</td>
                        <td className="text-slate-700">{inspection.inspectorName}</td>
                        <td>
                          {inspection.completedAt ? (
                            <Badge tone={result.tone}>{result.label}</Badge>
                          ) : (
                            <Badge tone="warning">in Bearbeitung</Badge>
                          )}
                        </td>
                        <td className="tabular whitespace-nowrap text-slate-600">
                          {formatDate(inspection.nextDueDate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Serviceberichte" bodyClassName="">
            {(data.serviceReports ?? []).length === 0 ? (
              <EmptyState title="Noch kein Servicebericht" />
            ) : (
              <Table>
                <tbody>
                  {(data.serviceReports ?? []).map((report) => (
                    <tr key={report.id}>
                      <td className="tabular">
                        <Link
                          href={`/serviceberichte/${report.id}`}
                          className="text-verweis font-medium hover:underline"
                        >
                          {report.reportNumber}
                        </Link>
                      </td>
                      <td className="tabular whitespace-nowrap text-slate-600">
                        {formatDate(report.date)}
                      </td>
                      <td className="max-w-md truncate text-slate-700">{report.workPerformed}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="tabular text-right text-slate-900">{value}</dd>
    </div>
  );
}
