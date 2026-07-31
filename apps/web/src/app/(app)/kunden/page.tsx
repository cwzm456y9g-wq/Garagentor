'use client';

import { customerDisplayName, customerTypeLabels, formatAddress } from '@garagentor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { ListPage } from '@/components/list-page';
import { Badge, LinkButton, PageHeader, Select } from '@/components/ui';
import { useList } from '@/lib/hooks';
import type { Customer } from '@/lib/types';

export default function CustomersPage() {
  const [type, setType] = useState('');
  const [active, setActive] = useState('true');

  const state = useList<Customer>('/customers', {
    type: type || undefined,
    active: active === '' ? undefined : active,
  });

  return (
    <>
      <PageHeader
        title="Kunden"
        subtitle="Stammdaten, Objekte und Ansprechpartner"
        actions={<LinkButton href="/kunden/neu">Kunde anlegen</LinkButton>}
      />

      <ListPage
        state={state}
        searchPlaceholder="Nummer, Name, E-Mail oder Telefon …"
        rowKey={(customer) => customer.id}
        emptyTitle="Noch keine Kunden erfasst"
        emptyDescription="Legen Sie den ersten Kunden an, um Angebote und Aufträge zu erstellen."
        emptyAction={<LinkButton href="/kunden/neu">Kunde anlegen</LinkButton>}
        filters={
          <>
            <Select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="max-w-48"
              aria-label="Kundenart"
            >
              <option value="">Alle Kundenarten</option>
              {Object.entries(customerTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              value={active}
              onChange={(event) => setActive(event.target.value)}
              className="max-w-40"
              aria-label="Status"
            >
              <option value="true">Nur aktive</option>
              <option value="false">Nur inaktive</option>
              <option value="">Alle</option>
            </Select>
          </>
        }
        columns={
          <>
            <th>Nummer</th>
            <th>Name</th>
            <th>Anschrift</th>
            <th>Kontakt</th>
            <th className="text-right">Anlagen</th>
            <th className="text-right">Aufträge</th>
          </>
        }
        renderRow={(customer) => (
          <>
            <td className="tabular whitespace-nowrap">
              <Link
                href={`/kunden/${customer.id}`}
                className="text-marine-700 font-medium hover:underline"
              >
                {customer.customerNumber}
              </Link>
            </td>
            <td>
              <span className="font-medium text-slate-900">{customerDisplayName(customer)}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <Badge tone={customer.type === 'PRIVAT' ? 'neutral' : 'info'}>
                  {customerTypeLabels[customer.type]}
                </Badge>
                {!customer.active && <Badge tone="danger">inaktiv</Badge>}
              </span>
            </td>
            <td className="text-slate-600">
              {customer.addresses?.[0] ? formatAddress(customer.addresses[0]) : '–'}
            </td>
            <td className="text-slate-600">
              {customer.email && <span className="block">{customer.email}</span>}
              {customer.phone && <span className="block text-xs">{customer.phone}</span>}
              {!customer.email && !customer.phone && '–'}
            </td>
            <td className="tabular text-right">{customer._count?.doors ?? 0}</td>
            <td className="tabular text-right">{customer._count?.orders ?? 0}</td>
          </>
        )}
      />
    </>
  );
}
