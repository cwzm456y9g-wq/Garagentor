'use client';

import {
  customerDisplayName,
  doorTypeLabels,
  formatDate,
  operationModeLabels,
} from '@garagentor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { AnlageEntfernen } from '@/components/beleg-entfernen';
import { ListPage } from '@/components/list-page';
import { Badge, LinkButton, PageHeader, Select } from '@/components/ui';
import { useList } from '@/lib/hooks';
import { doorStatus, inspectionDueTone } from '@/lib/status';
import type { Door } from '@/lib/types';

export default function DoorsPage() {
  const [type, setType] = useState('');
  const [operationMode, setOperationMode] = useState('');
  const [inspectionDue, setInspectionDue] = useState(false);

  const state = useList<Door>('/doors', {
    type: type || undefined,
    operationMode: operationMode || undefined,
    inspectionDue: inspectionDue || undefined,
  });

  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Toranlagen"
        subtitle="Anlagenbestand mit Prüffristen nach ASR A1.7"
        actions={<LinkButton href="/tore/neu">Toranlage anlegen</LinkButton>}
      />

      <ListPage
        state={state}
        searchPlaceholder="Nummer, Einbauort, Hersteller oder Seriennummer …"
        rowKey={(door) => door.id}
        emptyTitle="Keine Toranlagen erfasst"
        emptyDescription="Legen Sie die erste Anlage an – Prüfungen und Serviceberichte hängen daran."
        filters={
          <>
            <Select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="max-w-52"
              aria-label="Tortyp"
            >
              <option value="">Alle Tortypen</option>
              {Object.entries(doorTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              value={operationMode}
              onChange={(event) => setOperationMode(event.target.value)}
              className="max-w-44"
              aria-label="Betriebsart"
            >
              <option value="">Alle Betriebsarten</option>
              {Object.entries(operationModeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={inspectionDue}
                onChange={(event) => setInspectionDue(event.target.checked)}
                className="rounded border-slate-300"
              />
              Prüfung fällig
            </label>
          </>
        }
        columns={
          <>
            <th>Nummer</th>
            <th>Kunde / Objekt</th>
            <th>Einbauort</th>
            <th>Typ</th>
            <th>Status</th>
            <th>Nächste Prüfung</th>
            <th />
          </>
        }
        renderRow={(door) => {
          // Nicht „state“: Der Listenzustand heißt oben schon so, und ein
          // überschatteter Name hat hier bereits einmal einen Fehler gekostet.
          const anzeige = doorStatus(door.status);
          const due = door.nextInspectionDue ? new Date(door.nextInspectionDue).getTime() : null;
          const days = due === null ? null : Math.round((due - now) / 86_400_000);
          const overdue = due !== null && due < now;

          return (
            <>
              <td className="tabular whitespace-nowrap">
                <Link
                  href={`/tore/${door.id}`}
                  className="text-verweis font-medium hover:underline"
                >
                  {door.doorNumber}
                </Link>
                <span className="block text-xs text-slate-500">
                  {operationModeLabels[door.operationMode]}
                </span>
              </td>
              <td className="text-slate-700">
                {door.customer ? customerDisplayName(door.customer) : '–'}
                {door.site && (
                  <span className="block text-xs text-slate-500">{door.site.name}</span>
                )}
              </td>
              <td className="text-slate-700">{door.location}</td>
              <td className="text-slate-600">{doorTypeLabels[door.type]}</td>
              <td>
                <Badge tone={anzeige.tone}>{anzeige.label}</Badge>
              </td>
              <td>
                {door.operationMode !== 'KRAFTBETAETIGT' ? (
                  <span className="text-xs text-slate-500">nicht prüfpflichtig</span>
                ) : due === null ? (
                  <Badge tone="danger">noch nie geprüft</Badge>
                ) : (
                  <Badge tone={inspectionDueTone(days, overdue)}>
                    {formatDate(door.nextInspectionDue)}
                  </Badge>
                )}
              </td>
              <td className="text-right whitespace-nowrap">
                <AnlageEntfernen anlage={door} klein onEntfernt={() => state.reload()} />
              </td>
            </>
          );
        }}
      />
    </>
  );
}
