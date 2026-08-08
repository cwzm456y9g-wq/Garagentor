'use client';

import {
  customerDisplayName,
  formatCurrency,
  formatDate,
  maintenanceContractStatusLabels,
} from '@garagentor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { ListPage } from '@/components/list-page';
import { Badge, Button, PageHeader, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction, useList } from '@/lib/hooks';
import { contractStatus } from '@/lib/status';
import type { MaintenanceContract } from '@/lib/types';

export default function ContractsPage() {
  const [status, setStatus] = useState('AKTIV');
  const [dueOnly, setDueOnly] = useState(false);

  const state = useList<MaintenanceContract>('/maintenance-contracts', {
    status: status || undefined,
    dueOnly: dueOnly || undefined,
  });

  const record = useAction((id: string) =>
    api.post(`/maintenance-contracts/${id}/record-service`, {}),
  );
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Wartungsverträge"
        subtitle="Intervalle, Fälligkeiten und abgedeckte Toranlagen"
      />

      <ListPage
        state={state}
        searchPlaceholder="Vertragsnummer oder Bezeichnung …"
        rowKey={(contract) => contract.id}
        emptyTitle="Keine Wartungsverträge"
        filters={
          <>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="max-w-44"
              aria-label="Status"
            >
              <option value="">Alle Status</option>
              {Object.entries(maintenanceContractStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={dueOnly}
                onChange={(event) => setDueOnly(event.target.checked)}
                className="rounded border-slate-300"
              />
              Wartung fällig
            </label>
          </>
        }
        columns={
          <>
            <th>Nummer</th>
            <th>Kunde</th>
            <th>Bezeichnung</th>
            <th className="text-right">Intervall</th>
            <th>Nächste Wartung</th>
            <th className="text-right">Anlagen</th>
            <th className="text-right">Pauschale</th>
            <th>Status</th>
            <th />
          </>
        }
        renderRow={(contract) => {
          const state2 = contractStatus(contract.status);
          const due =
            contract.nextServiceDate && new Date(contract.nextServiceDate).getTime() <= now;

          return (
            <>
              <td className="tabular whitespace-nowrap font-medium text-slate-900">
                {contract.contractNumber}
              </td>
              <td className="text-slate-700">
                {contract.customer ? (
                  <Link
                    href={`/kunden/${contract.customer.id}`}
                    className="text-verweis hover:underline"
                  >
                    {customerDisplayName(contract.customer)}
                  </Link>
                ) : (
                  '–'
                )}
              </td>
              <td className="max-w-xs truncate text-slate-700">
                {contract.title}
                {contract.includesInspection && (
                  <Badge tone="info" className="ml-2">
                    inkl. Prüfung
                  </Badge>
                )}
              </td>
              <td className="tabular whitespace-nowrap text-right text-slate-600">
                {contract.intervalMonths} Mon.
              </td>
              <td className="tabular whitespace-nowrap">
                <span className={due ? 'font-medium text-hinweis' : 'text-slate-600'}>
                  {formatDate(contract.nextServiceDate)}
                </span>
              </td>
              <td className="tabular text-right text-slate-600">{contract.doors?.length ?? 0}</td>
              <td className="tabular whitespace-nowrap text-right font-medium">
                {formatCurrency(contract.price)}
              </td>
              <td>
                <Badge tone={state2.tone}>{state2.label}</Badge>
              </td>
              <td className="text-right">
                {contract.status === 'AKTIV' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      if (await record.run(contract.id)) state.reload();
                    }}
                  >
                    Einsatz vermerken
                  </Button>
                )}
              </td>
            </>
          );
        }}
      />
    </>
  );
}
