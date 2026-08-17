'use client';

import { employmentTypeLabels, formatDate, formatNumber } from '@garagentor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { MitarbeiterEntfernen } from '@/components/beleg-entfernen';
import { ListPage } from '@/components/list-page';
import { Badge, Card, EmptyState, LinkButton, LoadingState, PageHeader } from '@/components/ui';
import { useApi, useList } from '@/lib/hooks';
import type { Employee, Qualification } from '@/lib/types';

export default function StaffPage() {
  const [qualifiedOnly, setQualifiedOnly] = useState(false);
  const state = useList<Employee>('/employees', {
    active: true,
    qualifiedInspectorsOnly: qualifiedOnly || undefined,
  });

  const expiring = useApi<Qualification[]>('/employees/expiring-qualifications', {
    withinDays: 180,
  });

  return (
    <>
      <PageHeader
        title="Personal"
        subtitle="Mitarbeiter, Qualifikationen und Sachkundenachweise"
        actions={<LinkButton href="/personal/neu">Mitarbeiter anlegen</LinkButton>}
      />

      <Card title="Ablaufende Qualifikationen" className="mb-6" bodyClassName="">
        {expiring.loading ? (
          <LoadingState />
        ) : (expiring.data ?? []).length === 0 ? (
          <EmptyState
            title="Keine Frist in den nächsten 180 Tagen"
            description="Alle hinterlegten Nachweise sind ausreichend lange gültig."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {(expiring.data ?? []).map((qualification) => (
              <li
                key={qualification.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm"
              >
                <span>
                  <span className="font-medium text-slate-900">
                    {qualification.employee?.firstName} {qualification.employee?.lastName}
                  </span>
                  <span className="ml-2 text-slate-600">{qualification.name}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular text-slate-600">
                    {formatDate(qualification.expiresAt)}
                  </span>
                  <Badge tone={qualification.expired ? 'danger' : 'warning'}>
                    {qualification.expired
                      ? 'abgelaufen'
                      : `in ${qualification.daysUntilExpiry} Tagen`}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ListPage
        state={state}
        searchPlaceholder="Personalnummer, Name oder Position …"
        rowKey={(employee) => employee.id}
        emptyTitle="Keine Mitarbeiter erfasst"
        filters={
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={qualifiedOnly}
              onChange={(event) => setQualifiedOnly(event.target.checked)}
              className="rounded border-slate-300"
            />
            nur Sachkundige nach ASR A1.7
          </label>
        }
        columns={
          <>
            <th>Nummer</th>
            <th>Name</th>
            <th>Position</th>
            <th>Beschäftigung</th>
            <th>Eintritt</th>
            <th className="text-right">Wochenstunden</th>
            <th>Sachkunde</th>
            <th />
          </>
        }
        renderRow={(employee) => (
          <>
            <td className="tabular whitespace-nowrap">
              <Link
                href={`/personal/${employee.id}`}
                className="text-verweis font-medium hover:underline"
              >
                {employee.employeeNumber}
              </Link>
            </td>
            <td>
              <span className="text-slate-900">
                {employee.firstName} {employee.lastName}
              </span>
              {employee.user && (
                <span className="block text-xs text-slate-500">{employee.user.email}</span>
              )}
            </td>
            <td className="text-slate-600">{employee.position ?? '–'}</td>
            <td className="text-slate-600">{employmentTypeLabels[employee.employmentType]}</td>
            <td className="tabular whitespace-nowrap text-slate-600">
              {formatDate(employee.hireDate)}
            </td>
            <td className="tabular text-right text-slate-600">
              {formatNumber(employee.weeklyHours, 1)} h
            </td>
            <td>
              {(employee.qualifications ?? []).length > 0 ? (
                <Badge tone="success">
                  gültig bis {formatDate(employee.qualifications?.[0]?.expiresAt)}
                </Badge>
              ) : (
                <span className="text-xs text-slate-500">keine</span>
              )}
            </td>
            <td className="text-right whitespace-nowrap">
              <MitarbeiterEntfernen
                mitarbeiter={employee}
                klein
                onEntfernt={() => state.reload()}
              />
            </td>
          </>
        )}
      />
    </>
  );
}
