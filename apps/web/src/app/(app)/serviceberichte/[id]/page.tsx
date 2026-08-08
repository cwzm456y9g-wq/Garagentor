'use client';

import {
  customerDisplayName,
  formatCurrency,
  formatDate,
  formatHours,
  formatNumber,
  formatTime,
  type Paginated,
} from '@garagentor/shared';
import Link from 'next/link';
import { use, useState } from 'react';
import { PhotoGallery } from '@/components/photo-gallery';
import { SignaturePad } from '@/components/signature-pad';
import { MailButton } from '@/components/mail-dialog';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Table,
} from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction, useApi } from '@/lib/hooks';
import type { DocumentEntry, ServiceReport } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  ENTWURF: 'Entwurf',
  ABGESCHLOSSEN: 'Abgeschlossen',
  ABGERECHNET: 'Abgerechnet',
};

export default function ServiceReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<ServiceReport>(`/service-reports/${id}`);
  const fotos = useApi<Paginated<DocumentEntry>>('/documents', {
    entityType: 'SERVICE_REPORT',
    entityId: id,
    pageSize: 200,
  });

  const [signedByName, setSignedByName] = useState('');
  const [signatureTechnician, setSignatureTechnician] = useState<string | null>(null);
  const [signatureCustomer, setSignatureCustomer] = useState<string | null>(null);

  const complete = useAction((body: Record<string, unknown>) =>
    api.post(`/service-reports/${id}/complete`, body),
  );
  const pdf = useAction(() => api.openFile(`/service-reports/${id}/pdf`));

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState />;

  const materialTotal = (data.materials ?? []).reduce(
    (sum, material) => sum + material.quantity * material.unitPrice,
    0,
  );
  const draft = data.status === 'ENTWURF';

  /** Lädt ein Foto hoch und hängt es an den Bericht. */
  function ladeFotoHoch(datei: File) {
    const form = new FormData();
    form.append('file', datei);
    form.append('category', 'FOTO');
    form.append('entityType', 'SERVICE_REPORT');
    form.append('entityId', id);
    return api.post('/documents', form);
  }

  return (
    <>
      <PageHeader
        title={`Servicebericht ${data.reportNumber}`}
        actions={
          <>
            <Button variant="secondary" loading={pdf.loading} onClick={() => void pdf.run()}>
              Als PDF
            </Button>
            <MailButton art="SERVICEBERICHT" id={id} onSent={reload} />
          </>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{formatDate(data.date)}</span>
            {data.technician && (
              <span>
                · {data.technician.firstName} {data.technician.lastName}
              </span>
            )}
            <Badge
              tone={
                data.status === 'ENTWURF'
                  ? 'neutral'
                  : data.status === 'ABGERECHNET'
                    ? 'success'
                    : 'info'
              }
            >
              {STATUS_LABELS[data.status]}
            </Badge>
            {data.followUpRequired && <Badge tone="warning">Folgeauftrag erforderlich</Badge>}
          </span>
        }
      />

      {(complete.error ?? pdf.error) && (
        <div className="mb-4">
          <ErrorState message={(complete.error ?? pdf.error)!} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {data.faultDescription && (
            <Card title="Störungsbild">
              <p className="whitespace-pre-line text-sm text-slate-700">{data.faultDescription}</p>
            </Card>
          )}

          <Card title="Ausgeführte Arbeiten">
            <p className="whitespace-pre-line text-sm text-slate-700">{data.workPerformed}</p>
            {data.followUpNote && (
              <p className="mt-4 rounded-md border border-bernstein-200 bg-bernstein-50 px-3 py-2 text-sm text-bernstein-900">
                {data.followUpNote}
              </p>
            )}
          </Card>

          <Card title="Verbrauchtes Material" bodyClassName="">
            {(data.materials ?? []).length === 0 ? (
              <EmptyState title="Kein Material verbraucht" />
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <th>Bezeichnung</th>
                      <th className="text-right">Menge</th>
                      <th className="text-right">Einzelpreis</th>
                      <th className="text-right">Summe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.materials ?? []).map((material) => (
                      <tr key={material.id}>
                        <td>
                          <span className="text-slate-900">{material.name}</span>
                          {material.article && (
                            <span className="tabular block text-xs text-slate-500">
                              {material.article.articleNumber}
                            </span>
                          )}
                        </td>
                        <td className="tabular whitespace-nowrap text-right text-slate-700">
                          {formatNumber(material.quantity, 2)} {material.unit}
                        </td>
                        <td className="tabular whitespace-nowrap text-right text-slate-700">
                          {formatCurrency(material.unitPrice)}
                        </td>
                        <td className="tabular whitespace-nowrap text-right font-medium">
                          {formatCurrency(material.quantity * material.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <div className="border-t border-slate-200 px-5 py-3 text-right text-sm">
                  <span className="text-slate-600">Materialwert </span>
                  <span className="tabular font-semibold">{formatCurrency(materialTotal)}</span>
                </div>
              </>
            )}
          </Card>

          <Card title="Fotos vom Einsatz">
            <PhotoGallery
              photos={fotos.data?.items ?? []}
              onUpload={ladeFotoHoch}
              onDeleted={fotos.reload}
              disabled={!draft}
              label="Foto aufnehmen"
            />
            <p className="mt-2 text-xs text-slate-500">
              Die Aufnahmen erscheinen im Bericht. Nach dem Abschluss lassen sie sich nicht mehr
              ändern.
            </p>
          </Card>

          {draft && (
            <Card title="Bericht abschließen">
              <p className="text-sm text-slate-600">
                Mit dem Abschluss wird das verbrauchte Material aus dem Lager ausgebucht. Der
                Bericht ist danach nicht mehr änderbar.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Gegenzeichnung durch"
                  htmlFor="signedByName"
                  hint="Name der Person, die den Einsatz vor Ort bestätigt."
                >
                  <Input
                    id="signedByName"
                    value={signedByName}
                    onChange={(event) => setSignedByName(event.target.value)}
                  />
                </Field>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <SignaturePad
                  label={`Monteur${
                    data.technician
                      ? ` – ${data.technician.firstName} ${data.technician.lastName}`
                      : ''
                  }`}
                  value={signatureTechnician}
                  onChange={setSignatureTechnician}
                />
                <SignaturePad
                  label="Kunde bzw. Beauftragter"
                  hint="Bestätigt die ausgeführten Arbeiten, nicht die Rechnungshöhe."
                  value={signatureCustomer}
                  onChange={setSignatureCustomer}
                />
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  loading={complete.loading}
                  onClick={async () => {
                    const fertig = await complete.run({
                      signedByName: signedByName || undefined,
                      signatureTechnician: signatureTechnician ?? undefined,
                      signatureCustomer: signatureCustomer ?? undefined,
                    });
                    if (fertig) reload();
                  }}
                >
                  Bericht abschließen
                </Button>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Zeiten und Anfahrt">
            <dl className="space-y-2 text-sm">
              <Row label="Ankunft" value={formatTime(data.arrivalTime)} />
              <Row label="Abfahrt" value={formatTime(data.departureTime)} />
              <Row label="Arbeitszeit" value={formatHours(data.workHours)} />
              <Row label="Fahrtzeit" value={formatHours(data.travelHours)} />
              <Row label="Gefahrene Strecke" value={`${formatNumber(data.travelKm, 0)} km`} />
            </dl>
          </Card>

          {data.door && (
            <Card title="Toranlage">
              <Link
                href={`/tore/${data.door.id}`}
                className="text-marine-700 tabular font-medium hover:underline"
              >
                {data.door.doorNumber}
              </Link>
              <p className="mt-0.5 text-sm text-slate-600">{data.door.location}</p>
              {data.door.customer && (
                <p className="mt-2 text-sm text-slate-600">
                  {customerDisplayName(data.door.customer)}
                </p>
              )}
            </Card>
          )}

          {data.order && (
            <Card title="Auftrag">
              <Link
                href={`/auftraege/${data.order.id}`}
                className="text-marine-700 tabular font-medium hover:underline"
              >
                {data.order.orderNumber}
              </Link>
              <p className="mt-0.5 text-sm text-slate-600">{data.order.subject}</p>
            </Card>
          )}

          {data.completedAt && (
            <Card title="Abschluss">
              <p className="text-sm text-slate-700">
                Abgeschlossen am {formatDate(data.completedAt)}
              </p>
              {data.signedByName && (
                <p className="mt-1 text-sm text-slate-600">
                  Gegengezeichnet von {data.signedByName}
                </p>
              )}

              {(data.signatureTechnician || data.signatureCustomer) && (
                <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                  <SignaturePad
                    label="Monteur"
                    value={data.signatureTechnician ?? null}
                    onChange={() => undefined}
                    disabled
                  />
                  <SignaturePad
                    label="Kunde"
                    value={data.signatureCustomer ?? null}
                    onChange={() => undefined}
                    disabled
                  />
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="tabular text-slate-900">{value}</dd>
    </div>
  );
}
