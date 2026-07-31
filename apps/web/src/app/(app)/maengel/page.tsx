'use client';

import {
  customerDisplayName,
  defectSeverityLabels,
  defectStatusLabels,
  formatDate,
} from '@garagentor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { ListPage } from '@/components/list-page';
import { Badge, Button, PageHeader, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction, useList } from '@/lib/hooks';
import { defectSeverity, defectStatus } from '@/lib/status';
import type { Defect } from '@/lib/types';

export default function DefectsPage() {
  const [status, setStatus] = useState('OFFEN');
  const [severity, setSeverity] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const state = useList<Defect>('/defects', {
    status: status || undefined,
    severity: severity || undefined,
    overdueOnly: overdueOnly || undefined,
  });

  const resolve = useAction((id: string) => api.post(`/defects/${id}/resolve`, {}));
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Mängel"
        subtitle="Beanstandungen aus Prüfungen und Serviceeinsätzen mit Behebungsfrist"
      />

      <ListPage
        state={state}
        searchPlaceholder="Bezeichnung des Mangels …"
        rowKey={(defect) => defect.id}
        emptyTitle="Keine Mängel"
        emptyDescription="Für die gewählten Filter liegen keine Beanstandungen vor."
        filters={
          <>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="max-w-44"
              aria-label="Status"
            >
              <option value="">Alle Status</option>
              {Object.entries(defectStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              value={severity}
              onChange={(event) => setSeverity(event.target.value)}
              className="max-w-48"
              aria-label="Schweregrad"
            >
              <option value="">Alle Schweregrade</option>
              {Object.entries(defectSeverityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(event) => setOverdueOnly(event.target.checked)}
                className="rounded border-slate-300"
              />
              Frist überschritten
            </label>
          </>
        }
        columns={
          <>
            <th>Mangel</th>
            <th>Anlage</th>
            <th>Kunde</th>
            <th>Schweregrad</th>
            <th>Frist</th>
            <th>Status</th>
            <th />
          </>
        }
        renderRow={(defect) => {
          const severityState = defectSeverity(defect.severity);
          const statusState = defectStatus(defect.status);
          const overdue =
            defect.dueDate &&
            defect.status !== 'BEHOBEN' &&
            new Date(defect.dueDate).getTime() < now;

          return (
            <>
              <td>
                <span className="font-medium text-slate-900">{defect.title}</span>
                {defect.inspection && (
                  <Link
                    href={`/pruefungen/${defect.inspection.id}`}
                    className="tabular mt-0.5 block text-xs text-slate-500 hover:underline"
                  >
                    aus {defect.inspection.inspectionNumber}
                  </Link>
                )}
              </td>
              <td>
                {defect.door && (
                  <Link
                    href={`/tore/${defect.door.id}`}
                    className="text-marine-700 tabular hover:underline"
                  >
                    {defect.door.doorNumber}
                  </Link>
                )}
                <span className="block text-xs text-slate-500">{defect.door?.location}</span>
              </td>
              <td className="text-slate-600">
                {defect.door?.customer ? customerDisplayName(defect.door.customer) : '–'}
              </td>
              <td>
                <Badge tone={severityState.tone}>{severityState.label}</Badge>
              </td>
              <td className="tabular whitespace-nowrap">
                <span className={overdue ? 'font-medium text-red-700' : 'text-slate-600'}>
                  {formatDate(defect.dueDate)}
                </span>
              </td>
              <td>
                <Badge tone={statusState.tone}>{statusState.label}</Badge>
              </td>
              <td className="text-right">
                {defect.status !== 'BEHOBEN' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      if (await resolve.run(defect.id)) state.reload();
                    }}
                  >
                    Behoben
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
