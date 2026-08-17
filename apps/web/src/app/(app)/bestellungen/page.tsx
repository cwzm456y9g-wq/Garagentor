'use client';

import {
  formatCurrency,
  formatDate,
  formatNumber,
  purchaseOrderStatusLabels,
} from '@garagentor/shared';
import { useState } from 'react';
import { EntfernenKnopf } from '@/components/entfernen';
import { ListPage } from '@/components/list-page';
import { Badge, Card, EmptyState, LoadingState, PageHeader, Select, Table } from '@/components/ui';
import { useApi, useList } from '@/lib/hooks';
import { purchaseOrderStatus } from '@/lib/status';
import type { PurchaseOrder, ReorderSuggestion } from '@/lib/types';

export default function PurchaseOrdersPage() {
  const [status, setStatus] = useState('');
  const state = useList<PurchaseOrder>('/purchase-orders', { status: status || undefined });
  const suggestions = useApi<ReorderSuggestion[]>('/purchase-orders/reorder-suggestions');

  return (
    <>
      <PageHeader
        title="Bestellungen"
        subtitle="Beschaffung mit Wareneingang und Bestellvorschlägen"
      />

      <Card title="Bestellvorschläge aus dem Meldebestand" className="mb-6" bodyClassName="">
        {suggestions.loading ? (
          <LoadingState />
        ) : (suggestions.data ?? []).length === 0 ? (
          <EmptyState
            title="Kein Bestellbedarf"
            description="Alle bestandsgeführten Artikel liegen über dem Meldebestand."
          />
        ) : (
          (suggestions.data ?? []).map((group) => (
            <div
              key={group.supplierId ?? 'ohne'}
              className="border-b border-slate-100 last:border-0"
            >
              <div className="flex items-center justify-between gap-4 bg-slate-50 px-5 py-2">
                <span className="text-sm font-medium text-slate-900">{group.supplierName}</span>
                <span className="tabular text-sm text-slate-600">
                  {group.positionen.length} Position(en) · {formatCurrency(group.summe)}
                </span>
              </div>
              <Table>
                <tbody>
                  {group.positionen.map((position) => (
                    <tr key={position.articleId}>
                      <td className="tabular w-28 text-slate-500">{position.articleNumber}</td>
                      <td className="text-slate-900">{position.name}</td>
                      <td className="tabular whitespace-nowrap text-right text-slate-600">
                        Bestand {formatNumber(position.stock, 0)} / Melde{' '}
                        {formatNumber(position.minStock, 0)}
                      </td>
                      <td className="tabular whitespace-nowrap text-right font-medium">
                        Vorschlag {formatNumber(position.vorschlagsmenge, 0)} {position.unit}
                      </td>
                      <td className="tabular whitespace-nowrap text-right text-slate-600">
                        {formatCurrency(position.summe)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ))
        )}
      </Card>

      <ListPage
        state={state}
        searchPlaceholder="Bestellnummer oder Lieferant …"
        rowKey={(order) => order.id}
        emptyTitle="Keine Bestellungen"
        filters={
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="max-w-48"
            aria-label="Status"
          >
            <option value="">Alle Status</option>
            {Object.entries(purchaseOrderStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        }
        columns={
          <>
            <th>Nummer</th>
            <th>Lieferant</th>
            <th>Datum</th>
            <th>Erwartet</th>
            <th className="text-right">Positionen</th>
            <th>Status</th>
            <th className="text-right">Netto</th>
            <th />
          </>
        }
        renderRow={(order) => {
          const state2 = purchaseOrderStatus(order.status);
          return (
            <>
              <td className="tabular whitespace-nowrap font-medium text-slate-900">
                {order.orderNumber}
              </td>
              <td className="text-slate-700">{order.supplier?.name ?? '–'}</td>
              <td className="tabular whitespace-nowrap text-slate-600">{formatDate(order.date)}</td>
              <td className="tabular whitespace-nowrap text-slate-600">
                {formatDate(order.expectedAt)}
              </td>
              <td className="tabular text-right">{order._count?.items ?? 0}</td>
              <td>
                <Badge tone={state2.tone}>{state2.label}</Badge>
              </td>
              <td className="tabular whitespace-nowrap text-right font-medium">
                {formatCurrency(order.netTotal)}
              </td>

              <td className="whitespace-nowrap text-right">
                <EntfernenKnopf
                  klein
                  pfad={`/purchase-orders/${order.id}`}
                  titel={`Bestellung ${order.orderNumber} löschen`}
                  beschreibung={
                    <>
                      Die Bestellung wird entfernt. Bereits gebuchte Wareneingänge bleiben im Lager
                      – der Bestand ist ja tatsächlich da.
                    </>
                  }
                  onEntfernt={() => state.reload()}
                />
              </td>
            </>
          );
        }}
      />
    </>
  );
}
