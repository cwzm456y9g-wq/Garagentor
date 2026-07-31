'use client';

import {
  customerDisplayName,
  formatCurrency,
  formatDate,
  formatHours,
  formatPercent,
} from '@garagentor/shared';
import Link from 'next/link';
import { use } from 'react';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
  Table,
} from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction, useApi } from '@/lib/hooks';
import { orderStatus, projectStatus } from '@/lib/status';
import type { Project, ProjectSummary } from '@/lib/types';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<Project>(`/projects/${id}`);
  const summary = useApi<ProjectSummary>(`/projects/${id}/summary`);

  const toggle = useAction((task: { taskId: string; done: boolean }) =>
    api.patch(`/projects/${id}/tasks/${task.taskId}`, {
      status: task.done ? 'ERLEDIGT' : 'OFFEN',
    }),
  );

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState />;

  const state = projectStatus(data.status);

  return (
    <>
      <PageHeader
        title={data.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular">{data.projectNumber}</span>
            <Badge tone={state.tone}>{state.label}</Badge>
            {data.customer && <span>· {customerDisplayName(data.customer)}</span>}
          </span>
        }
      />

      {summary.data && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Budget"
            value={summary.data.budget ? formatCurrency(summary.data.budget) : '–'}
            hint={
              summary.data.budgetAusgeschoepft != null
                ? `${formatPercent(summary.data.budgetAusgeschoepft)} beauftragt`
                : undefined
            }
            tone={
              summary.data.budgetAusgeschoepft != null && summary.data.budgetAusgeschoepft > 100
                ? 'danger'
                : 'info'
            }
          />
          <StatCard
            label="Auftragswert netto"
            value={formatCurrency(summary.data.auftragswert)}
            hint={`${summary.data.auftraege} Auftrag/Aufträge`}
          />
          <StatCard
            label="Abgerechnet netto"
            value={formatCurrency(summary.data.abgerechnetNetto)}
          />
          <StatCard
            label="Erfasste Stunden"
            value={formatHours(summary.data.stunden)}
            hint={`Fortschritt ${data.fortschritt ?? 0} %`}
          />
        </div>
      )}

      {toggle.error && (
        <div className="mb-4">
          <ErrorState message={toggle.error} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Aufgaben und Meilensteine" bodyClassName="">
          {(data.tasks ?? []).length === 0 ? (
            <EmptyState title="Keine Aufgaben hinterlegt" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {(data.tasks ?? []).map((task) => (
                <li key={task.id} className="flex items-start gap-3 px-5 py-3">
                  <input
                    type="checkbox"
                    checked={task.status === 'ERLEDIGT'}
                    onChange={async (event) => {
                      if (await toggle.run({ taskId: task.id, done: event.target.checked })) {
                        reload();
                      }
                    }}
                    className="mt-0.5 rounded border-slate-300"
                    aria-label={`Aufgabe ${task.title} abhaken`}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        task.status === 'ERLEDIGT'
                          ? 'block text-sm text-slate-400 line-through'
                          : 'block text-sm font-medium text-slate-900'
                      }
                    >
                      {task.title}
                      {task.milestone && (
                        <Badge tone="info" className="ml-2">
                          Meilenstein
                        </Badge>
                      )}
                    </span>
                    {task.description && (
                      <span className="block text-xs text-slate-500">{task.description}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-right text-xs text-slate-500">
                    {task.dueDate && (
                      <span className="tabular block">{formatDate(task.dueDate)}</span>
                    )}
                    {task.assignee && (
                      <span className="block">
                        {task.assignee.firstName} {task.assignee.lastName}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Aufträge" bodyClassName="">
            {(data.orders ?? []).length === 0 ? (
              <EmptyState title="Noch kein Auftrag zugeordnet" />
            ) : (
              <Table>
                <tbody>
                  {(data.orders ?? []).map((order) => {
                    const orderState = orderStatus(order.status);
                    return (
                      <tr key={order.id}>
                        <td className="tabular">
                          <Link
                            href={`/auftraege/${order.id}`}
                            className="text-marine-700 font-medium hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                          <span className="block text-xs text-slate-500">{order.subject}</span>
                        </td>
                        <td>
                          <Badge tone={orderState.tone}>{orderState.label}</Badge>
                        </td>
                        <td className="tabular text-right font-medium">
                          {formatCurrency(order.netTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>

          {data.description && (
            <Card title="Beschreibung">
              <p className="whitespace-pre-line text-sm text-slate-700">{data.description}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
