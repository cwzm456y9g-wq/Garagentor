'use client';

import {
  customerDisplayName,
  formatCurrency,
  formatDate,
  orderStatusLabels,
  orderTypeLabels,
} from '@garagentor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { ListPage } from '@/components/list-page';
import { Badge, PageHeader, Select } from '@/components/ui';
import { useList } from '@/lib/hooks';
import { orderStatus } from '@/lib/status';
import type { Order } from '@/lib/types';

export default function OrdersPage() {
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [openOnly, setOpenOnly] = useState(false);

  const state = useList<Order>('/orders', {
    status: status || undefined,
    type: type || undefined,
    open: openOnly || undefined,
  });

  return (
    <>
      <PageHeader title="Aufträge" subtitle="Montage, Reparatur, Wartung und Prüfung" />

      <ListPage
        state={state}
        searchPlaceholder="Nummer, Betreff, Referenz oder Kunde …"
        rowKey={(order) => order.id}
        emptyTitle="Noch keine Aufträge"
        emptyDescription="Aufträge entstehen meist aus einem angenommenen Angebot."
        filters={
          <>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="max-w-48"
              aria-label="Status"
            >
              <option value="">Alle Status</option>
              {Object.entries(orderStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="max-w-40"
              aria-label="Auftragsart"
            >
              <option value="">Alle Arten</option>
              {Object.entries(orderTypeLabels).map(([value, label]) => (
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
              nur laufende
            </label>
          </>
        }
        columns={
          <>
            <th>Nummer</th>
            <th>Kunde</th>
            <th>Betreff</th>
            <th>Art</th>
            <th>Termin</th>
            <th>Status</th>
            <th className="text-right">Netto</th>
          </>
        }
        renderRow={(order) => {
          const state = orderStatus(order.status);
          return (
            <>
              <td className="tabular whitespace-nowrap">
                <Link
                  href={`/auftraege/${order.id}`}
                  className="text-verweis font-medium hover:underline"
                >
                  {order.orderNumber}
                </Link>
                {order.customerReference && (
                  <span className="block text-xs text-slate-500">
                    Ref. {order.customerReference}
                  </span>
                )}
              </td>
              <td className="text-slate-700">
                {order.customer ? customerDisplayName(order.customer) : '–'}
              </td>
              <td className="max-w-xs truncate text-slate-700">{order.subject}</td>
              <td className="text-slate-600">{orderTypeLabels[order.type]}</td>
              <td className="tabular whitespace-nowrap text-slate-600">
                {formatDate(order.plannedStart)}
              </td>
              <td>
                <Badge tone={state.tone}>{state.label}</Badge>
              </td>
              <td className="tabular whitespace-nowrap text-right font-medium">
                {formatCurrency(order.netTotal)}
              </td>
            </>
          );
        }}
      />
    </>
  );
}
