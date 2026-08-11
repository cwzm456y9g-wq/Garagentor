'use client';

import { formatDate, formatHours, formatNumber } from '@garagentor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { ListPage } from '@/components/list-page';
import { Badge, LinkButton, PageHeader, Select } from '@/components/ui';
import { useList } from '@/lib/hooks';
import type { ServiceReport } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  ENTWURF: 'Entwurf',
  ABGESCHLOSSEN: 'Abgeschlossen',
  ABGERECHNET: 'Abgerechnet',
};

export default function ServiceReportsPage() {
  const [status, setStatus] = useState('');
  const state = useList<ServiceReport>('/service-reports', { status: status || undefined });

  return (
    <>
      <PageHeader
        title="Serviceberichte"
        subtitle="Einsatzdokumentation mit Zeiten, Material und Unterschrift"
        actions={<LinkButton href="/serviceberichte/neu">Bericht anlegen</LinkButton>}
      />

      <ListPage
        state={state}
        searchPlaceholder="Berichtsnummer, Störung oder Arbeiten …"
        rowKey={(report) => report.id}
        emptyTitle="Noch keine Serviceberichte"
        filters={
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="max-w-48"
            aria-label="Status"
          >
            <option value="">Alle Status</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        }
        columns={
          <>
            <th>Nummer</th>
            <th>Datum</th>
            <th>Anlage</th>
            <th>Monteur</th>
            <th>Ausgeführte Arbeiten</th>
            <th className="text-right">Arbeitszeit</th>
            <th className="text-right">Anfahrt</th>
            <th>Status</th>
          </>
        }
        renderRow={(report) => (
          <>
            <td className="tabular whitespace-nowrap">
              <Link
                href={`/serviceberichte/${report.id}`}
                className="text-verweis font-medium hover:underline"
              >
                {report.reportNumber}
              </Link>
            </td>
            <td className="tabular whitespace-nowrap text-slate-600">{formatDate(report.date)}</td>
            <td className="tabular text-slate-700">{report.door?.doorNumber ?? '–'}</td>
            <td className="whitespace-nowrap text-slate-700">
              {report.technician
                ? `${report.technician.firstName} ${report.technician.lastName}`
                : '–'}
            </td>
            <td className="max-w-md truncate text-slate-600">{report.workPerformed}</td>
            <td className="tabular whitespace-nowrap text-right text-slate-700">
              {formatHours(report.workHours)}
            </td>
            <td className="tabular whitespace-nowrap text-right text-slate-600">
              {formatNumber(report.travelKm, 0)} km
            </td>
            <td>
              <Badge
                tone={
                  report.status === 'ENTWURF'
                    ? 'neutral'
                    : report.status === 'ABGERECHNET'
                      ? 'success'
                      : 'info'
                }
              >
                {STATUS_LABELS[report.status]}
              </Badge>
              {report.followUpRequired && (
                <Badge tone="warning" className="ml-1">
                  Folgeauftrag
                </Badge>
              )}
            </td>
          </>
        )}
      />
    </>
  );
}
