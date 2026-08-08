'use client';

import {
  customerDisplayName,
  formatCurrency,
  formatDate,
  projectStatusLabels,
} from '@garagentor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { ListPage } from '@/components/list-page';
import { Badge, PageHeader, Select } from '@/components/ui';
import { useList } from '@/lib/hooks';
import { projectStatus } from '@/lib/status';
import type { Project } from '@/lib/types';

export default function ProjectsPage() {
  const [status, setStatus] = useState('');
  const state = useList<Project>('/projects', { status: status || undefined });

  return (
    <>
      <PageHeader title="Projekte" subtitle="Größere Vorhaben mit Aufgaben und Budget" />

      <ListPage
        state={state}
        searchPlaceholder="Projektnummer, Name oder Beschreibung …"
        rowKey={(project) => project.id}
        emptyTitle="Keine Projekte"
        filters={
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="max-w-48"
            aria-label="Status"
          >
            <option value="">Alle Status</option>
            {Object.entries(projectStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        }
        columns={
          <>
            <th>Nummer</th>
            <th>Projekt</th>
            <th>Kunde</th>
            <th>Leitung</th>
            <th>Zeitraum</th>
            <th className="text-right">Aufträge</th>
            <th className="text-right">Budget</th>
            <th>Status</th>
          </>
        }
        renderRow={(project) => {
          const state2 = projectStatus(project.status);
          return (
            <>
              <td className="tabular whitespace-nowrap">
                <Link
                  href={`/projekte/${project.id}`}
                  className="text-verweis font-medium hover:underline"
                >
                  {project.projectNumber}
                </Link>
              </td>
              <td className="max-w-xs truncate text-slate-900">{project.name}</td>
              <td className="text-slate-600">
                {project.customer ? customerDisplayName(project.customer) : '–'}
              </td>
              <td className="whitespace-nowrap text-slate-600">
                {project.manager ? `${project.manager.firstName} ${project.manager.lastName}` : '–'}
              </td>
              <td className="tabular whitespace-nowrap text-slate-600">
                {formatDate(project.startDate)} – {formatDate(project.endDate)}
              </td>
              <td className="tabular text-right">{project._count?.orders ?? 0}</td>
              <td className="tabular whitespace-nowrap text-right text-slate-700">
                {project.budget ? formatCurrency(project.budget) : '–'}
              </td>
              <td>
                <Badge tone={state2.tone}>{state2.label}</Badge>
              </td>
            </>
          );
        }}
      />
    </>
  );
}
