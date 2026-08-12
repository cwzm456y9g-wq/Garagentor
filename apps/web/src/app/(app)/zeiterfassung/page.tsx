'use client';

import {
  formatDate,
  formatHours,
  formatTime,
  timeEntryTypeLabels,
  toIsoDate,
  type TimeEntryType,
} from '@garagentor/shared';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { EntfernenKnopf } from '@/components/entfernen';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatCard,
  Table,
} from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useAction, useApi } from '@/lib/hooks';
import type { TimeEntry } from '@/lib/types';

export default function TimeTrackingPage() {
  const { user } = useAuth();
  const [from, setFrom] = useState(() => {
    // Standardmäßig die laufende Woche ab Montag.
    const date = new Date();
    const offset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - offset);
    return toIsoDate(date);
  });

  const [formOpen, setFormOpen] = useState(false);
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('16:30');
  const [breakMinutes, setBreakMinutes] = useState('30');
  const [type, setType] = useState<TimeEntryType>('ARBEITSZEIT');
  const [description, setDescription] = useState('');

  const to = (() => {
    const value = new Date(from);
    value.setDate(value.getDate() + 6);
    return toIsoDate(value);
  })();

  const list = useApi<{ items: TimeEntry[]; summeStunden: number }>('/time-entries', {
    from,
    to,
    pageSize: 200,
  });

  const create = useAction((body: Record<string, unknown>) => api.post('/time-entries', body));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await create.run({
      type,
      start: new Date(`${date}T${start}:00`).toISOString(),
      end: new Date(`${date}T${end}:00`).toISOString(),
      breakMinutes: Number(breakMinutes) || 0,
      description: description || undefined,
    });
    if (result) {
      setFormOpen(false);
      setDescription('');
      list.reload();
    }
  }

  const entries = list.data?.items ?? [];
  const billable = entries
    .filter((entry) => entry.billable)
    .reduce((sum, entry) => sum + entry.hours, 0);

  return (
    <>
      <PageHeader
        title="Zeiterfassung"
        subtitle={
          user?.role === 'MONTEUR'
            ? 'Ihre erfassten Zeiten der gewählten Woche'
            : 'Erfasste Zeiten der gewählten Woche'
        }
        actions={
          <>
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              aria-label="Wochenbeginn"
              className="w-40"
            />
            <Button onClick={() => setFormOpen((open) => !open)}>Zeit erfassen</Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Summe der Woche"
          value={formatHours(list.data?.summeStunden ?? 0)}
          hint={`${formatDate(from)} – ${formatDate(to)}`}
          tone="info"
        />
        <StatCard label="Abrechenbar" value={formatHours(billable)} tone="success" />
        <StatCard label="Einträge" value={entries.length} />
      </div>

      {formOpen && (
        <Card title="Zeit erfassen" className="mb-6">
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-5" noValidate>
            <Field label="Datum" htmlFor="date" required>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </Field>
            <Field label="Von" htmlFor="start" required>
              <Input
                id="start"
                type="time"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                required
              />
            </Field>
            <Field label="Bis" htmlFor="end" required>
              <Input
                id="end"
                type="time"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                required
              />
            </Field>
            <Field label="Pause (Minuten)" htmlFor="breakMinutes">
              <Input
                id="breakMinutes"
                type="number"
                min={0}
                max={480}
                value={breakMinutes}
                onChange={(event) => setBreakMinutes(event.target.value)}
              />
            </Field>
            <Field label="Art" htmlFor="type">
              <Select
                id="type"
                value={type}
                onChange={(event) => setType(event.target.value as TimeEntryType)}
              >
                {Object.entries(timeEntryTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tätigkeit" htmlFor="description" className="sm:col-span-4">
              <Input
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="z. B. Montage Sectionaltor"
              />
            </Field>
            <div className="flex items-end gap-2">
              <Button type="submit" loading={create.loading}>
                Speichern
              </Button>
            </div>
            {create.error && (
              <div className="sm:col-span-5">
                <ErrorState message={create.error} />
              </div>
            )}
          </form>
        </Card>
      )}

      <Card title="Erfasste Zeiten" bodyClassName="">
        {list.error ? (
          <div className="p-5">
            <ErrorState message={list.error} onRetry={list.reload} />
          </div>
        ) : list.loading ? (
          <LoadingState />
        ) : entries.length === 0 ? (
          <EmptyState
            title="Keine Zeiten in dieser Woche"
            description="Über „Zeit erfassen“ lässt sich ein Eintrag anlegen."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Mitarbeiter</th>
                <th>Von – bis</th>
                <th className="text-right">Pause</th>
                <th className="text-right">Stunden</th>
                <th>Art</th>
                <th>Zuordnung</th>
                <th>Tätigkeit</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="tabular whitespace-nowrap text-slate-700">
                    {formatDate(entry.date)}
                  </td>
                  <td className="whitespace-nowrap text-slate-700">
                    {entry.employee
                      ? `${entry.employee.firstName} ${entry.employee.lastName}`
                      : '–'}
                  </td>
                  <td className="tabular whitespace-nowrap text-slate-600">
                    {formatTime(entry.start)} – {formatTime(entry.end)}
                  </td>
                  <td className="tabular text-right text-slate-600">{entry.breakMinutes} min</td>
                  <td className="tabular text-right font-medium">{formatHours(entry.hours)}</td>
                  <td>
                    <Badge tone={entry.billable ? 'success' : 'neutral'}>
                      {timeEntryTypeLabels[entry.type]}
                    </Badge>
                  </td>
                  <td className="tabular whitespace-nowrap text-slate-600">
                    {entry.order ? (
                      <Link href={`/auftraege/${entry.order.id}`} className="hover:underline">
                        {entry.order.orderNumber}
                      </Link>
                    ) : entry.project ? (
                      <Link href={`/projekte/${entry.project.id}`} className="hover:underline">
                        {entry.project.projectNumber}
                      </Link>
                    ) : (
                      '–'
                    )}
                  </td>
                  <td className="max-w-xs truncate text-slate-600">{entry.description ?? '–'}</td>
                  <td className="whitespace-nowrap text-right">
                    <EntfernenKnopf
                      klein
                      pfad={`/time-entries/${entry.id}`}
                      titel="Zeiteintrag entfernen"
                      beschriftung="Entfernen"
                      beschreibung={
                        <>
                          Der Eintrag über {formatHours(entry.hours)} wird entfernt. Ist er schon
                          abgerechnet, fehlt er anschließend in der Nachkalkulation – der Beleg
                          selbst bleibt davon unberührt.
                        </>
                      }
                      onEntfernt={() => list.reload()}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
