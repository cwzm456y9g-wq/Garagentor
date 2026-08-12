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
import { EntfernenKnopf } from '@/components/entfernen';
import { Badge, Button, LinkButton, PageHeader, Select } from '@/components/ui';
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
        actions={<LinkButton href="/wartungsvertraege/neu">Vertrag anlegen</LinkButton>}
      />

      <ListPage
        state={state}
        searchPlaceholder="Vertragsnummer oder Bezeichnung …"
        rowKey={(contract) => contract.id}
        emptyTitle="Keine Wartungsverträge"
        emptyDescription="Ein Vertrag bündelt Intervall, Pauschale und die abgedeckten Toranlagen."
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
              <td className="tabular whitespace-nowrap">
                <Link
                  href={`/wartungsvertraege/${contract.id}/bearbeiten`}
                  className="text-verweis font-medium hover:underline"
                >
                  {contract.contractNumber}
                </Link>
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
              <td className="whitespace-nowrap text-right">
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
                <EntfernenKnopf
                  klein
                  pfad={`/maintenance-contracts/${contract.id}`}
                  titel={
                    contract.lastServiceDate
                      ? `Wartungsvertrag ${contract.contractNumber} kündigen`
                      : `Wartungsvertrag ${contract.contractNumber} löschen`
                  }
                  beschriftung={contract.lastServiceDate ? 'Kündigen' : 'Löschen'}
                  knopf={contract.lastServiceDate ? 'Kündigen' : 'Endgültig löschen'}
                  beschreibung={
                    contract.lastServiceDate ? (
                      <>
                        Unter diesem Vertrag wurde bereits gewartet – zuletzt am{' '}
                        {formatDate(contract.lastServiceDate)}. Er wird deshalb nicht gelöscht,
                        sondern auf „gekündigt“ gesetzt: Der nächste Termin entfällt, die Historie
                        bleibt lesbar. Die {contract.doors?.length ?? 0} zugeordneten Anlagen
                        behalten ihre Prüffristen.
                      </>
                    ) : (
                      <>
                        Unter diesem Vertrag wurde noch nicht gewartet – er wird vollständig
                        gelöscht. Die Zuordnung zu den {contract.doors?.length ?? 0} Toranlagen
                        entfällt damit; die Anlagen selbst bleiben mit ihren Prüffristen erhalten.
                      </>
                    )
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
