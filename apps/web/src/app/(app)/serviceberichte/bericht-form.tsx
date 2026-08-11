'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { CustomerPicker } from '@/components/customer-picker';
import { EmployeePicker } from '@/components/employee-picker';
import { Button, Card, ErrorState, Field, Input, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction } from '@/lib/hooks';
import type { Door, ServiceReport } from '@/lib/types';

interface FormValues {
  customerId: string;
  doorId: string;
  technicianId: string;
  date: string;
  workHours: string;
  travelHours: string;
  travelKm: string;
  faultDescription: string;
  workPerformed: string;
  followUpRequired: boolean;
  followUpNote: string;
}

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

function text(wert: string): string | undefined {
  return wert.trim() || undefined;
}

function zahl(wert: string): number | undefined {
  const sauber = wert.trim();
  if (!sauber) return undefined;
  const nummer = Number(sauber);
  return Number.isFinite(nummer) ? nummer : undefined;
}

/**
 * Formular für einen neuen Servicebericht.
 *
 * Angelegt wird hier nur der Rahmen: Wer war wann bei welcher Anlage, was war
 * defekt, was wurde getan. Unterschrift, Fotos und das Ausbuchen des Materials
 * folgen beim Abschluss auf der Seite des Berichts – das geschieht vor Ort und
 * funktioniert auch ohne Netz.
 *
 * Der Kunde wird nicht mitgeschickt; er ergibt sich aus der Anlage. Er steht
 * hier nur, um die Auswahl der Toranlagen einzugrenzen – ein Monteur soll
 * nicht durch den ganzen Anlagenbestand blättern.
 */
export function ServiceReportForm({ tor }: { tor?: string }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({
    customerId: '',
    doorId: tor ?? '',
    technicianId: '',
    date: heute(),
    workHours: '',
    travelHours: '',
    travelKm: '',
    faultDescription: '',
    workPerformed: '',
    followUpRequired: false,
    followUpNote: '',
  });
  const [doors, setDoors] = useState<Door[]>([]);

  const save = useAction(async (payload: Record<string, unknown>) =>
    api.post<ServiceReport>('/service-reports', payload),
  );

  // Kommt die Anlage schon aus dem Aufruf, wird ihr Kunde nachgetragen, damit
  // die Auswahl daneben stimmig aussieht.
  useEffect(() => {
    if (!tor) return;

    let aktuell = true;
    api
      .get<Door>(`/doors/${tor}`)
      .then((anlage) => {
        if (aktuell) setValues((current) => ({ ...current, customerId: anlage.customerId }));
      })
      .catch(() => undefined);

    return () => {
      aktuell = false;
    };
  }, [tor]);

  useEffect(() => {
    let aktuell = true;

    api
      .list<Door>('/doors', {
        customerId: values.customerId || undefined,
        pageSize: 200,
      })
      .then((seite) => {
        if (aktuell) setDoors(seite.items);
      })
      .catch(() => setDoors([]));

    return () => {
      aktuell = false;
    };
  }, [values.customerId]);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => {
      if (key === 'customerId' && value !== current.customerId) {
        return { ...current, customerId: value as string, doorId: '' };
      }
      return { ...current, [key]: value };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const result = await save.run({
      doorId: text(values.doorId),
      technicianId: text(values.technicianId),
      date: text(values.date),
      workHours: zahl(values.workHours),
      travelHours: zahl(values.travelHours),
      travelKm: zahl(values.travelKm),
      faultDescription: text(values.faultDescription),
      workPerformed: values.workPerformed,
      followUpRequired: values.followUpRequired || undefined,
      followUpNote: values.followUpRequired ? text(values.followUpNote) : undefined,
    });

    if (result) router.push(`/serviceberichte/${result.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card title="Einsatz">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kunde" htmlFor="customerId" hint="Grenzt die Auswahl der Anlagen ein.">
            <CustomerPicker value={values.customerId} onChange={(id) => set('customerId', id)} />
          </Field>

          <Field
            label="Toranlage"
            htmlFor="doorId"
            hint={
              values.customerId && doors.length === 0
                ? 'Für diesen Kunden ist keine Anlage erfasst.'
                : undefined
            }
          >
            <Select
              id="doorId"
              value={values.doorId}
              onChange={(e) => set('doorId', e.target.value)}
            >
              <option value="">Ohne Anlagenbezug</option>
              {doors.map((door) => (
                <option key={door.id} value={door.id}>
                  {door.doorNumber} · {door.location}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Monteur" htmlFor="technicianId">
            <EmployeePicker
              id="technicianId"
              value={values.technicianId}
              onChange={(id) => set('technicianId', id)}
            />
          </Field>

          <Field label="Datum" htmlFor="date">
            <Input
              id="date"
              type="date"
              value={values.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card title="Arbeiten">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Störungsmeldung des Kunden"
            htmlFor="faultDescription"
            className="sm:col-span-2"
          >
            <textarea
              id="faultDescription"
              className="input min-h-20"
              value={values.faultDescription}
              onChange={(e) => set('faultDescription', e.target.value)}
              maxLength={4000}
            />
          </Field>

          <Field
            label="Ausgeführte Arbeiten"
            htmlFor="workPerformed"
            className="sm:col-span-2"
            required
            hint="Steht so im Bericht, den der Kunde unterschreibt."
          >
            <textarea
              id="workPerformed"
              className="input min-h-28"
              value={values.workPerformed}
              onChange={(e) => set('workPerformed', e.target.value)}
              maxLength={4000}
              required
            />
          </Field>
        </div>
      </Card>

      <Card title="Zeiten">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Arbeitszeit in Stunden" htmlFor="workHours">
            <Input
              id="workHours"
              type="number"
              min={0}
              max={24}
              step="0.25"
              value={values.workHours}
              onChange={(e) => set('workHours', e.target.value)}
            />
          </Field>
          <Field label="Fahrtzeit in Stunden" htmlFor="travelHours">
            <Input
              id="travelHours"
              type="number"
              min={0}
              max={24}
              step="0.25"
              value={values.travelHours}
              onChange={(e) => set('travelHours', e.target.value)}
            />
          </Field>
          <Field label="Gefahrene Kilometer" htmlFor="travelKm">
            <Input
              id="travelKm"
              type="number"
              min={0}
              step="0.1"
              value={values.travelKm}
              onChange={(e) => set('travelKm', e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card title="Nacharbeit">
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={values.followUpRequired}
              onChange={(e) => set('followUpRequired', e.target.checked)}
              className="rounded border-slate-300"
            />
            Ein weiterer Termin ist nötig
          </label>

          {values.followUpRequired && (
            <Field label="Was noch zu tun ist" htmlFor="followUpNote">
              <textarea
                id="followUpNote"
                className="input min-h-20"
                value={values.followUpNote}
                onChange={(e) => set('followUpNote', e.target.value)}
                maxLength={2000}
              />
            </Field>
          )}
        </div>
      </Card>

      {save.error && <ErrorState message={save.error} />}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={save.loading}>
          Bericht anlegen
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
