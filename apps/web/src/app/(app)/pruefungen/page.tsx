'use client';

import { customerDisplayName, formatDate, inspectionTypeLabels } from '@garagentor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { ListPage } from '@/components/list-page';
import { Badge, PageHeader, Select } from '@/components/ui';
import { useList } from '@/lib/hooks';
import { inspectionResult } from '@/lib/status';
import type { Inspection } from '@/lib/types';

export default function InspectionsPage() {
  const [type, setType] = useState('');
  const [openOnly, setOpenOnly] = useState(false);

  const state = useList<Inspection>('/inspections', {
    type: type || undefined,
    openOnly: openOnly || undefined,
  });

  return (
    <>
      <PageHeader
        title="Prüfungen"
        subtitle="Wiederkehrende Prüfung kraftbetätigter Tore nach ASR A1.7"
      />

      <ListPage
        state={state}
        searchPlaceholder="Protokollnummer, prüfende Person oder Anlage …"
        rowKey={(inspection) => inspection.id}
        emptyTitle="Noch keine Prüfprotokolle"
        emptyDescription="Eine Prüfung wird auf der Seite der jeweiligen Toranlage begonnen."
        filters={
          <>
            <Select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="max-w-56"
              aria-label="Prüfart"
            >
              <option value="">Alle Prüfarten</option>
              {Object.entries(inspectionTypeLabels).map(([value, label]) => (
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
              nur offene Protokolle
            </label>
          </>
        }
        columns={
          <>
            <th>Protokoll</th>
            <th>Anlage</th>
            <th>Kunde</th>
            <th>Datum</th>
            <th>Prüfende Person</th>
            <th>Ergebnis</th>
            <th className="text-right">Mängel</th>
          </>
        }
        renderRow={(inspection) => {
          const result = inspectionResult(inspection.result);
          return (
            <>
              <td className="tabular whitespace-nowrap">
                <Link
                  href={`/pruefungen/${inspection.id}`}
                  className="text-marine-700 font-medium hover:underline"
                >
                  {inspection.inspectionNumber}
                </Link>
              </td>
              <td className="text-slate-700">
                {inspection.door && (
                  <>
                    <Link href={`/tore/${inspection.door.id}`} className="tabular hover:underline">
                      {inspection.door.doorNumber}
                    </Link>
                    <span className="block text-xs text-slate-500">{inspection.door.location}</span>
                  </>
                )}
              </td>
              <td className="text-slate-600">
                {inspection.door?.customer ? customerDisplayName(inspection.door.customer) : '–'}
              </td>
              <td className="tabular whitespace-nowrap text-slate-600">
                {formatDate(inspection.date)}
              </td>
              <td className="text-slate-700">{inspection.inspectorName}</td>
              <td>
                {inspection.completedAt ? (
                  <Badge tone={result.tone}>{result.label}</Badge>
                ) : (
                  <Badge tone="warning">in Bearbeitung</Badge>
                )}
              </td>
              <td className="tabular text-right">{inspection._count?.defects ?? 0}</td>
            </>
          );
        }}
      />
    </>
  );
}
