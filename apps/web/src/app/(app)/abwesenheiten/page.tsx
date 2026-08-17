'use client';

import {
  absenceStatusLabels,
  absenceTypeLabels,
  formatDate,
  formatNumber,
  toIsoDate,
  type AbsenceType,
} from '@garagentor/shared';
import { useState, type FormEvent } from 'react';
import { ListPage } from '@/components/list-page';
import { Badge, Button, Card, ErrorState, Field, Input, PageHeader, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useAction, useList } from '@/lib/hooks';
import { absenceStatus } from '@/lib/status';
import type { Absence } from '@/lib/types';

export default function AbsencesPage() {
  const { hasRole } = useAuth();
  const mayDecide = hasRole('GESCHAEFTSFUEHRUNG', 'BUERO');

  const [status, setStatus] = useState('');
  const state = useList<Absence>('/absences', { status: status || undefined });

  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<AbsenceType>('URLAUB');
  const [from, setFrom] = useState(toIsoDate(new Date()));
  const [to, setTo] = useState(toIsoDate(new Date()));
  const [reason, setReason] = useState('');

  const create = useAction((body: Record<string, unknown>) => api.post('/absences', body));
  // Serverseitig gab es das Stornieren längst – nur keinen Knopf dafür. Ein
  // versehentlich eingetragener Urlaub ließ sich deshalb nicht zurücknehmen.
  const storno = useAction((id: string) => api.post(`/absences/${id}/cancel`));
  const decide = useAction((input: { id: string; status: 'GENEHMIGT' | 'ABGELEHNT' }) =>
    api.post(`/absences/${input.id}/decide`, { status: input.status }),
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await create.run({ type, from, to, reason: reason || undefined });
    if (result) {
      setFormOpen(false);
      setReason('');
      state.reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Abwesenheiten"
        subtitle="Urlaub, Krankheit und Schulungen mit Genehmigungslauf"
        actions={
          <Button onClick={() => setFormOpen((open) => !open)}>Abwesenheit beantragen</Button>
        }
      />

      {decide.error && (
        <div className="mb-4">
          <ErrorState message={decide.error} />
        </div>
      )}

      {formOpen && (
        <Card title="Abwesenheit beantragen" className="mb-6">
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-4" noValidate>
            <Field label="Art" htmlFor="type" required>
              <Select
                id="type"
                value={type}
                onChange={(event) => setType(event.target.value as AbsenceType)}
              >
                {Object.entries(absenceTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Von" htmlFor="from" required>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                required
              />
            </Field>
            <Field
              label="Bis"
              htmlFor="to"
              hint="Die Werktage werden automatisch ermittelt."
              required
            >
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                required
              />
            </Field>
            <Field label="Begründung" htmlFor="reason">
              <Input
                id="reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-4">
              <Button type="submit" loading={create.loading}>
                Antrag stellen
              </Button>
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
                Abbrechen
              </Button>
            </div>
            {create.error && (
              <div className="sm:col-span-4">
                <ErrorState message={create.error} />
              </div>
            )}
          </form>
        </Card>
      )}

      <ListPage
        state={state}
        searchPlaceholder="Suche …"
        rowKey={(absence) => absence.id}
        emptyTitle="Keine Abwesenheiten"
        filters={
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="max-w-44"
            aria-label="Status"
          >
            <option value="">Alle Status</option>
            {Object.entries(absenceStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        }
        columns={
          <>
            <th>Mitarbeiter</th>
            <th>Art</th>
            <th>Zeitraum</th>
            <th className="text-right">Werktage</th>
            <th>Begründung</th>
            <th>Status</th>
            <th />
          </>
        }
        renderRow={(absence) => {
          const state2 = absenceStatus(absence.status);
          return (
            <>
              <td className="whitespace-nowrap text-slate-900">
                {absence.employee
                  ? `${absence.employee.firstName} ${absence.employee.lastName}`
                  : '–'}
              </td>
              <td className="text-slate-600">{absenceTypeLabels[absence.type]}</td>
              <td className="tabular whitespace-nowrap text-slate-700">
                {formatDate(absence.from)} – {formatDate(absence.to)}
              </td>
              <td className="tabular text-right font-medium">{formatNumber(absence.days, 1)}</td>
              <td className="max-w-xs truncate text-slate-600">{absence.reason ?? '–'}</td>
              <td>
                <Badge tone={state2.tone}>{state2.label}</Badge>
                {absence.approver && (
                  <span className="block text-xs text-slate-500">
                    durch {absence.approver.firstName} {absence.approver.lastName}
                  </span>
                )}
              </td>
              <td className="text-right">
                {mayDecide && absence.status === 'BEANTRAGT' && (
                  <span className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (await decide.run({ id: absence.id, status: 'GENEHMIGT' })) {
                          state.reload();
                        }
                      }}
                    >
                      Genehmigen
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        if (await decide.run({ id: absence.id, status: 'ABGELEHNT' })) {
                          state.reload();
                        }
                      }}
                    >
                      Ablehnen
                    </Button>
                  </span>
                )}
                {absence.status !== 'STORNIERT' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (await storno.run(absence.id)) state.reload();
                    }}
                  >
                    Stornieren
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
