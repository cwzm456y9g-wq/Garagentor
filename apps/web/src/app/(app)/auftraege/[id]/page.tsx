'use client';

import {
  customerDisplayName,
  formatAddress,
  formatCurrency,
  formatDate,
  formatHours,
  invoiceTypeLabels,
  orderStatusLabels,
  orderTypeLabels,
  type OrderStatus,
} from '@garagentor/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { DocumentItems } from '@/components/document-items';
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
} from '@/components/ui';
import { AuftragEntfernen } from '@/components/beleg-entfernen';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useAction, useApi } from '@/lib/hooks';
import { appointmentStatus, invoiceStatus, orderStatus } from '@/lib/status';
import type { Order, OrderCosts } from '@/lib/types';

/** Statuswechsel, die die API vom jeweiligen Stand aus zulässt. */
const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  ANGELEGT: ['EINGEPLANT', 'IN_ARBEIT', 'STORNIERT'],
  EINGEPLANT: ['IN_ARBEIT', 'ANGELEGT', 'STORNIERT'],
  IN_ARBEIT: ['WARTET_AUF_MATERIAL', 'ABGESCHLOSSEN', 'EINGEPLANT', 'STORNIERT'],
  WARTET_AUF_MATERIAL: ['IN_ARBEIT', 'STORNIERT'],
  ABGESCHLOSSEN: ['ABGERECHNET', 'IN_ARBEIT'],
  ABGERECHNET: [],
  STORNIERT: [],
};

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { hasRole } = useAuth();
  const { data, loading, error, reload } = useApi<Order>(`/orders/${id}`);
  const mayInvoice = hasRole('GESCHAEFTSFUEHRUNG', 'BUERO', 'BUCHHALTUNG');
  const costs = useApi<OrderCosts>(mayInvoice ? `/orders/${id}/costs` : null);

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [partialPercent, setPartialPercent] = useState('');

  const changeStatus = useAction((status: OrderStatus) =>
    api.patch(`/orders/${id}/status`, { status }),
  );
  const invoice = useAction((body: Record<string, unknown>) =>
    api.post<{ id: string }>(`/orders/${id}/invoice`, body),
  );

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState />;

  const status = orderStatus(data.status);
  const transitions = NEXT_STATUSES[data.status];
  const actionError = changeStatus.error ?? invoice.error;

  return (
    <>
      <PageHeader
        title={data.subject}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular">{data.orderNumber}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
            <span>{orderTypeLabels[data.type]}</span>
          </span>
        }
        actions={
          <>
            {transitions.length > 0 && (
              <Select
                value=""
                onChange={async (event) => {
                  if (!event.target.value) return;
                  if (await changeStatus.run(event.target.value as OrderStatus)) reload();
                }}
                className="max-w-56"
                aria-label="Status wechseln"
              >
                <option value="">Status wechseln …</option>
                {transitions.map((value) => (
                  <option key={value} value={value}>
                    {orderStatusLabels[value]}
                  </option>
                ))}
              </Select>
            )}
            {mayInvoice && data.status !== 'STORNIERT' && (
              <Button onClick={() => setInvoiceOpen((open) => !open)}>Rechnung erstellen</Button>
            )}
            <AuftragEntfernen auftrag={data} onEntfernt={() => router.push('/auftraege')} />
          </>
        }
      />

      {actionError && (
        <div className="mb-4">
          <ErrorState message={actionError} />
        </div>
      )}

      {invoiceOpen && (
        <Card title="Rechnung erstellen" className="mb-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Abschlag in Prozent"
              htmlFor="partialPercent"
              hint="Leer lassen für die vollständige Abrechnung."
            >
              <Input
                id="partialPercent"
                type="number"
                min={1}
                max={100}
                step="0.01"
                value={partialPercent}
                onChange={(event) => setPartialPercent(event.target.value)}
                placeholder="z. B. 30"
              />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2">
              <Button
                loading={invoice.loading}
                onClick={async () => {
                  const created = await invoice.run(
                    partialPercent
                      ? { partialPercent: Number(partialPercent) }
                      : { type: 'SCHLUSSRECHNUNG' },
                  );
                  if (created) window.location.assign(`/rechnungen/${created.id}`);
                }}
              >
                {partialPercent ? 'Abschlagsrechnung erstellen' : 'Schlussrechnung erstellen'}
              </Button>
              <Button variant="secondary" onClick={() => setInvoiceOpen(false)}>
                Abbrechen
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Positionen" bodyClassName="">
            <DocumentItems
              items={data.items ?? []}
              netTotal={data.netTotal}
              vatTotal={data.vatTotal}
              grossTotal={data.grossTotal}
              discountPercent={data.discountPercent}
            />
          </Card>

          {(data.appointments ?? []).length > 0 && (
            <Card title="Termine" bodyClassName="">
              <Table>
                <thead>
                  <tr>
                    <th>Termin</th>
                    <th>Bezeichnung</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.appointments ?? []).map((appointment) => {
                    const state = appointmentStatus(appointment.status);
                    return (
                      <tr key={appointment.id}>
                        <td className="tabular whitespace-nowrap text-slate-700">
                          {formatDate(appointment.start)}
                        </td>
                        <td className="text-slate-700">{appointment.title}</td>
                        <td>
                          <Badge tone={state.tone}>{state.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>
          )}

          {(data.invoices ?? []).length > 0 && (
            <Card title="Rechnungen" bodyClassName="">
              <Table>
                <thead>
                  <tr>
                    <th>Nummer</th>
                    <th>Art</th>
                    <th>Datum</th>
                    <th>Status</th>
                    <th className="text-right">Brutto</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.invoices ?? []).map((row) => {
                    const state = invoiceStatus(row.status);
                    return (
                      <tr key={row.id}>
                        <td className="tabular">
                          <Link
                            href={`/rechnungen/${row.id}`}
                            className="text-verweis font-medium hover:underline"
                          >
                            {row.invoiceNumber}
                          </Link>
                        </td>
                        <td className="text-slate-600">{invoiceTypeLabels[row.type]}</td>
                        <td className="tabular text-slate-600">{formatDate(row.date)}</td>
                        <td>
                          <Badge tone={state.tone}>{state.label}</Badge>
                        </td>
                        <td className="tabular text-right font-medium">
                          {formatCurrency(row.grossTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>
          )}

          {(data.serviceReports ?? []).length > 0 && (
            <Card title="Serviceberichte" bodyClassName="">
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
                      <td className="tabular text-slate-600">{formatDate(report.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Kunde">
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
                <span className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Objekt
                </span>
                {data.site.name}
                <span className="block">{formatAddress(data.site)}</span>
              </p>
            )}
          </Card>

          <Card title="Termine und Bezüge">
            <dl className="space-y-2 text-sm">
              <Row label="Geplanter Beginn" value={formatDate(data.plannedStart)} />
              <Row label="Geplantes Ende" value={formatDate(data.plannedEnd)} />
              <Row label="Abgeschlossen" value={formatDate(data.completedAt)} />
              {data.quote && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Angebot</dt>
                  <dd>
                    <Link
                      href={`/angebote/${data.quote.id}`}
                      className="text-verweis tabular hover:underline"
                    >
                      {data.quote.quoteNumber}
                    </Link>
                  </dd>
                </div>
              )}
              {data.project && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Projekt</dt>
                  <dd>
                    <Link
                      href={`/projekte/${data.project.id}`}
                      className="text-verweis hover:underline"
                    >
                      {data.project.projectNumber}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {costs.data && (
            <Card title="Nachkalkulation">
              <dl className="space-y-2 text-sm">
                <Row label="Erfasste Stunden" value={formatHours(costs.data.stunden)} />
                <Row
                  label="Material (Einkauf)"
                  value={formatCurrency(costs.data.materialEinkauf)}
                />
                <Row
                  label="Abgerechnet netto"
                  value={formatCurrency(costs.data.abgerechnetNetto)}
                />
              </dl>
              {costs.data.stundenNachArt.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {costs.data.stundenNachArt.map((row) => (
                    <li key={row.typ} className="flex justify-between">
                      <span>{row.typ}</span>
                      <span className="tabular">{formatHours(row.stunden)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {data.description && (
            <Card title="Beschreibung">
              <p className="whitespace-pre-line text-sm text-slate-700">{data.description}</p>
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
      <dd className="tabular text-right text-slate-900">{value}</dd>
    </div>
  );
}
