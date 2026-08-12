'use client';

import {
  appointmentTypeLabels,
  customerDisplayName,
  formatAddress,
  formatDate,
  formatTime,
  toIsoDate,
} from '@garagentor/shared';
import Link from 'next/link';
import { useState } from 'react';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LinkButton,
  LoadingState,
  PageHeader,
} from '@/components/ui';
import { EntfernenKnopf } from '@/components/entfernen';
import { useApi } from '@/lib/hooks';
import { appointmentStatus } from '@/lib/status';
import type { Appointment } from '@/lib/types';

export default function AppointmentsPage() {
  const [from, setFrom] = useState(toIsoDate(new Date()));
  // Standardmäßig werden zwei Wochen im Voraus angezeigt.
  const [to, setTo] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return toIsoDate(date);
  });

  const { data, loading, error, reload } = useApi<{ items: Appointment[] }>('/appointments', {
    from: new Date(from).toISOString(),
    to: new Date(`${to}T23:59:59`).toISOString(),
    pageSize: 200,
  });

  // Termine werden nach Tagen gruppiert dargestellt.
  const byDay = new Map<string, Appointment[]>();
  for (const appointment of data?.items ?? []) {
    const key = appointment.start.slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), appointment]);
  }

  return (
    <>
      <PageHeader
        title="Termine"
        subtitle="Einsatzplanung nach Tagen"
        actions={
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              aria-label="Von"
              className="w-40"
            />
            <span className="text-sm text-slate-500">bis</span>
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              aria-label="Bis"
              className="w-40"
            />
            <LinkButton href="/termine/neu">Termin anlegen</LinkButton>
          </div>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <LoadingState />
      ) : byDay.size === 0 ? (
        <Card>
          <EmptyState
            title="Keine Termine im Zeitraum"
            description="Bitte einen anderen Zeitraum wählen."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {[...byDay.entries()].map(([day, appointments]) => (
            <Card key={day} title={formatDate(day)} bodyClassName="">
              <ul className="divide-y divide-slate-100">
                {appointments.map((appointment) => {
                  const state = appointmentStatus(appointment.status);
                  return (
                    <li key={appointment.id} className="flex flex-wrap gap-4 px-5 py-3">
                      <span className="tabular w-28 shrink-0 text-sm text-slate-600">
                        {appointment.allDay
                          ? 'ganztägig'
                          : `${formatTime(appointment.start)} – ${formatTime(appointment.end)}`}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-slate-900">
                          {appointment.title}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{appointmentTypeLabels[appointment.type]}</span>
                          {appointment.customer && (
                            <Link
                              href={`/kunden/${appointment.customer.id}`}
                              className="hover:underline"
                            >
                              {customerDisplayName(appointment.customer)}
                            </Link>
                          )}
                          {appointment.site && <span>{formatAddress(appointment.site)}</span>}
                          {appointment.order && (
                            <Link
                              href={`/auftraege/${appointment.order.id}`}
                              className="tabular hover:underline"
                            >
                              {appointment.order.orderNumber}
                            </Link>
                          )}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-wrap items-start gap-1.5">
                        {(appointment.assignees ?? []).map((employee) => (
                          <Badge key={employee.id} tone="neutral">
                            {employee.firstName} {employee.lastName}
                          </Badge>
                        ))}
                        <Badge tone={state.tone}>{state.label}</Badge>
                        <EntfernenKnopf
                          klein
                          pfad={`/appointments/${appointment.id}`}
                          titel={`Termin „${appointment.title}“ entfernen`}
                          beschriftung="Entfernen"
                          beschreibung={
                            <>
                              Der Termin wird entfernt und verschwindet bei den eingeteilten
                              Mitarbeitern aus „Mein Tag“. Serviceberichte oder Prüfungen, die
                              daraus entstanden sind, bleiben bestehen.
                            </>
                          }
                          onEntfernt={reload}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
