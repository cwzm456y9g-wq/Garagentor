'use client';

import {
  customerDisplayName,
  customerTypeLabels,
  formatAddress,
  formatCurrency,
  formatDate,
  formatPercent,
  salutationLabels,
} from '@garagentor/shared';
import Link from 'next/link';
import { use } from 'react';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  LoadingState,
  PageHeader,
  StatCard,
  Table,
} from '@/components/ui';
import { useApi } from '@/lib/hooks';
import type { Customer, CustomerStatistics, Door, Invoice, Quote } from '@/lib/types';
import { doorStatus, invoiceStatus, quoteStatus } from '@/lib/status';

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const customer = useApi<Customer>(`/customers/${id}`);
  const stats = useApi<CustomerStatistics>(`/customers/${id}/statistics`);
  const doors = useApi<{ items: Door[] }>('/doors', { customerId: id, pageSize: 20 });
  const quotes = useApi<{ items: Quote[] }>('/quotes', { customerId: id, pageSize: 5 });
  const invoices = useApi<{ items: Invoice[] }>('/invoices', { customerId: id, pageSize: 5 });

  if (customer.error) return <ErrorState message={customer.error} onRetry={customer.reload} />;
  if (customer.loading || !customer.data) return <LoadingState />;

  const data = customer.data;
  const billing = data.addresses?.find((address) => address.type === 'RECHNUNG');

  return (
    <>
      <PageHeader
        title={customerDisplayName(data)}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular">{data.customerNumber}</span>
            <Badge tone={data.type === 'PRIVAT' ? 'neutral' : 'info'}>
              {customerTypeLabels[data.type]}
            </Badge>
            {!data.active && <Badge tone="danger">inaktiv</Badge>}
          </span>
        }
        actions={
          <>
            <LinkButton href={`/angebote/neu?customerId=${data.id}`} variant="secondary">
              Angebot erstellen
            </LinkButton>
            <LinkButton href={`/kunden/${data.id}/bearbeiten`}>Bearbeiten</LinkButton>
          </>
        }
      />

      {stats.data && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Umsatz netto"
            value={formatCurrency(stats.data.umsatzNetto)}
            hint={`${stats.data.rechnungenAnzahl} Rechnung(en)`}
            tone="info"
          />
          <StatCard
            label="Offene Posten"
            value={formatCurrency(stats.data.offenePosten)}
            hint={`${stats.data.offenePostenAnzahl} Rechnung(en)`}
            tone={stats.data.offenePosten > 0 ? 'warning' : 'success'}
          />
          <StatCard
            label="Überfällig"
            value={formatCurrency(stats.data.ueberfaellig)}
            tone={stats.data.ueberfaellig > 0 ? 'danger' : 'success'}
          />
          <StatCard
            label="Offene Angebote"
            value={stats.data.offeneAngebote}
            hint="versendet, noch nicht entschieden"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card title="Kontakt">
            <dl className="space-y-2.5 text-sm">
              {data.salutation && <Row label="Anrede" value={salutationLabels[data.salutation]} />}
              <Row label="E-Mail" value={data.email ?? '–'} />
              <Row label="Telefon" value={data.phone ?? '–'} />
              <Row label="Mobil" value={data.mobile ?? '–'} />
              <Row label="USt-IdNr." value={data.vatId ?? '–'} />
            </dl>
          </Card>

          <Card title="Konditionen">
            <dl className="space-y-2.5 text-sm">
              <Row label="Zahlungsziel" value={`${data.paymentTermsDays} Tage`} />
              <Row label="Kundenrabatt" value={formatPercent(data.discountPercent)} />
              <Row label="Rechnungsanschrift" value={billing ? formatAddress(billing) : '–'} />
            </dl>
          </Card>

          {data.notes && (
            <Card title="Notizen">
              <p className="whitespace-pre-line text-sm text-slate-700">{data.notes}</p>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card title="Ansprechpartner" bodyClassName="">
            {(data.contacts ?? []).length === 0 ? (
              <EmptyState title="Kein Ansprechpartner hinterlegt" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Funktion</th>
                    <th>Kontakt</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.contacts ?? []).map((contact) => (
                    <tr key={contact.id}>
                      <td>
                        <span className="font-medium text-slate-900">
                          {contact.firstName} {contact.lastName}
                        </span>
                        {contact.isPrimary && (
                          <Badge tone="info" className="ml-2">
                            Hauptkontakt
                          </Badge>
                        )}
                      </td>
                      <td className="text-slate-600">{contact.position ?? '–'}</td>
                      <td className="text-slate-600">
                        {contact.email && <span className="block">{contact.email}</span>}
                        {contact.phone && <span className="block text-xs">{contact.phone}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Objekte" bodyClassName="">
            {(data.sites ?? []).length === 0 ? (
              <EmptyState
                title="Kein Objekt hinterlegt"
                description="Objekte bündeln Toranlagen an einer Liegenschaft."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Bezeichnung</th>
                    <th>Anschrift</th>
                    <th>Zugang</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.sites ?? []).map((site) => (
                    <tr key={site.id}>
                      <td className="font-medium text-slate-900">{site.name}</td>
                      <td className="text-slate-600">{formatAddress(site)}</td>
                      <td className="max-w-xs text-xs text-slate-500">{site.accessNotes ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card
            title="Toranlagen"
            actions={
              <div className="flex items-center gap-3">
                <Link
                  href={`/tore/neu?kunde=${id}`}
                  className="text-verweis text-sm font-medium hover:underline"
                >
                  Anlage erfassen
                </Link>
                <Link href="/tore" className="text-verweis text-sm font-medium hover:underline">
                  Alle Anlagen
                </Link>
              </div>
            }
            bodyClassName=""
          >
            {(doors.data?.items ?? []).length === 0 ? (
              <EmptyState
                title="Keine Toranlage erfasst"
                description="Prüfungen nach ASR A1.7 und Serviceberichte setzen eine erfasste Anlage voraus."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Nummer</th>
                    <th>Einbauort</th>
                    <th>Status</th>
                    <th>Nächste Prüfung</th>
                  </tr>
                </thead>
                <tbody>
                  {(doors.data?.items ?? []).map((door) => {
                    const status = doorStatus(door.status);
                    return (
                      <tr key={door.id}>
                        <td className="tabular">
                          <Link
                            href={`/tore/${door.id}`}
                            className="text-verweis font-medium hover:underline"
                          >
                            {door.doorNumber}
                          </Link>
                        </td>
                        <td className="text-slate-700">{door.location}</td>
                        <td>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </td>
                        <td className="tabular text-slate-600">
                          {formatDate(door.nextInspectionDue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Letzte Angebote" bodyClassName="">
              {(quotes.data?.items ?? []).length === 0 ? (
                <EmptyState title="Kein Angebot vorhanden" />
              ) : (
                <Table>
                  <tbody>
                    {(quotes.data?.items ?? []).map((quote) => {
                      const status = quoteStatus(quote.status);
                      return (
                        <tr key={quote.id}>
                          <td>
                            <Link
                              href={`/angebote/${quote.id}`}
                              className="text-verweis tabular font-medium hover:underline"
                            >
                              {quote.quoteNumber}
                            </Link>
                            <span className="block text-xs text-slate-500">{quote.subject}</span>
                          </td>
                          <td>
                            <Badge tone={status.tone}>{status.label}</Badge>
                          </td>
                          <td className="tabular text-right font-medium">
                            {formatCurrency(quote.grossTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </Card>

            <Card title="Letzte Rechnungen" bodyClassName="">
              {(invoices.data?.items ?? []).length === 0 ? (
                <EmptyState title="Keine Rechnung vorhanden" />
              ) : (
                <Table>
                  <tbody>
                    {(invoices.data?.items ?? []).map((invoice) => {
                      const status = invoiceStatus(invoice.status);
                      return (
                        <tr key={invoice.id}>
                          <td>
                            <Link
                              href={`/rechnungen/${invoice.id}`}
                              className="text-verweis tabular font-medium hover:underline"
                            >
                              {invoice.invoiceNumber}
                            </Link>
                            <span className="block text-xs text-slate-500">
                              {formatDate(invoice.date)}
                            </span>
                          </td>
                          <td>
                            <Badge tone={status.tone}>{status.label}</Badge>
                          </td>
                          <td className="tabular text-right font-medium">
                            {formatCurrency(invoice.grossTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right text-slate-900">{value}</dd>
    </div>
  );
}
