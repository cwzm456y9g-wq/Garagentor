'use client';

import {
  customerDisplayName,
  formatCurrency,
  formatDate,
  invoiceStatusLabels,
  invoiceTypeLabels,
} from '@garagentor/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ListPage } from '@/components/list-page';
import { Badge, LinkButton, LoadingState, PageHeader, Select } from '@/components/ui';
import { useList } from '@/lib/hooks';
import { invoiceStatus } from '@/lib/status';
import type { Invoice } from '@/lib/types';

function InvoiceList() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('');
  const [openOnly, setOpenOnly] = useState(searchParams.get('openOnly') === 'true');

  const state = useList<Invoice>('/invoices', {
    status: status || undefined,
    openOnly: openOnly || undefined,
  });

  return (
    <ListPage
      state={state}
      searchPlaceholder="Nummer, Betreff oder Kunde …"
      rowKey={(invoice) => invoice.id}
      emptyTitle="Noch keine Rechnungen"
      emptyDescription="Rechnungen entstehen üblicherweise aus einem abgeschlossenen Auftrag."
      filters={
        <>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="max-w-44"
            aria-label="Status"
          >
            <option value="">Alle Status</option>
            {Object.entries(invoiceStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(event) => setOpenOnly(event.target.checked)}
              className="rounded border-slate-300"
            />
            nur offene Posten
          </label>
        </>
      }
      columns={
        <>
          <th>Nummer</th>
          <th>Kunde</th>
          <th>Betreff</th>
          <th>Datum</th>
          <th>Fällig</th>
          <th>Status</th>
          <th className="text-right">Brutto</th>
        </>
      }
      renderRow={(invoice) => {
        const state = invoiceStatus(invoice.status);
        const overdue =
          invoice.status === 'UEBERFAELLIG' ||
          (invoice.status !== 'BEZAHLT' &&
            invoice.status !== 'ENTWURF' &&
            invoice.status !== 'STORNIERT' &&
            new Date(invoice.dueDate) < new Date());

        return (
          <>
            <td className="tabular whitespace-nowrap">
              <Link
                href={`/rechnungen/${invoice.id}`}
                className="text-verweis font-medium hover:underline"
              >
                {invoice.invoiceNumber}
              </Link>
              {invoice.type !== 'RECHNUNG' && (
                <span className="block text-xs text-slate-500">
                  {invoiceTypeLabels[invoice.type]}
                </span>
              )}
            </td>
            <td className="text-slate-700">
              {invoice.customer ? customerDisplayName(invoice.customer) : '–'}
            </td>
            <td className="max-w-xs truncate text-slate-700">{invoice.subject}</td>
            <td className="tabular whitespace-nowrap text-slate-600">{formatDate(invoice.date)}</td>
            <td className="tabular whitespace-nowrap">
              <span className={overdue ? 'font-medium text-fehler' : 'text-slate-600'}>
                {formatDate(invoice.dueDate)}
              </span>
            </td>
            <td>
              <Badge tone={state.tone}>{state.label}</Badge>
              {invoice.dunningLevel && (
                <span className="mt-0.5 block text-xs text-slate-500">gemahnt</span>
              )}
            </td>
            <td className="tabular whitespace-nowrap text-right font-medium">
              {formatCurrency(invoice.grossTotal)}
            </td>
          </>
        );
      }}
    />
  );
}

export default function InvoicesPage() {
  return (
    <>
      <PageHeader
        title="Rechnungen"
        subtitle="Ausgangsrechnungen, Zahlungen und offene Posten"
        actions={<LinkButton href="/auftraege">Aus Auftrag abrechnen</LinkButton>}
      />
      <Suspense fallback={<LoadingState />}>
        <InvoiceList />
      </Suspense>
    </>
  );
}
