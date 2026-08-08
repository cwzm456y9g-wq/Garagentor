'use client';

import {
  customerDisplayName,
  formatCurrency,
  formatDate,
  quoteStatusLabels,
} from '@garagentor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { ListPage } from '@/components/list-page';
import { Badge, LinkButton, PageHeader, Select } from '@/components/ui';
import { useList } from '@/lib/hooks';
import { quoteStatus } from '@/lib/status';
import type { Quote } from '@/lib/types';

export default function QuotesPage() {
  const [status, setStatus] = useState('');
  const state = useList<Quote>('/quotes', { status: status || undefined });

  return (
    <>
      <PageHeader
        title="Angebote"
        subtitle="Vom Entwurf über den Versand bis zur Beauftragung"
        actions={<LinkButton href="/angebote/neu">Angebot erstellen</LinkButton>}
      />

      <ListPage
        state={state}
        searchPlaceholder="Nummer, Betreff oder Kunde …"
        rowKey={(quote) => quote.id}
        emptyTitle="Noch keine Angebote"
        emptyAction={<LinkButton href="/angebote/neu">Angebot erstellen</LinkButton>}
        filters={
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="max-w-48"
            aria-label="Status"
          >
            <option value="">Alle Status</option>
            {Object.entries(quoteStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        }
        columns={
          <>
            <th>Nummer</th>
            <th>Kunde</th>
            <th>Betreff</th>
            <th>Datum</th>
            <th>Gültig bis</th>
            <th>Status</th>
            <th className="text-right">Brutto</th>
          </>
        }
        renderRow={(quote) => {
          const status = quoteStatus(quote.status);
          const expiringSoon =
            quote.status === 'VERSENDET' &&
            new Date(quote.validUntil).getTime() - Date.now() < 7 * 86_400_000;

          return (
            <>
              <td className="tabular whitespace-nowrap">
                <Link
                  href={`/angebote/${quote.id}`}
                  className="text-verweis font-medium hover:underline"
                >
                  {quote.quoteNumber}
                </Link>
              </td>
              <td className="text-slate-700">
                {quote.customer ? customerDisplayName(quote.customer) : '–'}
              </td>
              <td className="max-w-xs truncate text-slate-700">{quote.subject}</td>
              <td className="tabular whitespace-nowrap text-slate-600">{formatDate(quote.date)}</td>
              <td className="tabular whitespace-nowrap">
                <span className={expiringSoon ? 'text-hinweis font-medium' : 'text-slate-600'}>
                  {formatDate(quote.validUntil)}
                </span>
              </td>
              <td>
                <Badge tone={status.tone}>{status.label}</Badge>
              </td>
              <td className="tabular whitespace-nowrap text-right font-medium">
                {formatCurrency(quote.grossTotal)}
              </td>
            </>
          );
        }}
      />
    </>
  );
}
