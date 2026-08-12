'use client';

import { DEFAULT_MAINTENANCE_INTERVAL_MONTHS, doorTypeLabels } from '@garagentor/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { CustomerPicker } from '@/components/customer-picker';
import { Button, Card, ErrorState, Field, Input } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction } from '@/lib/hooks';
import type { Door, MaintenanceContract } from '@/lib/types';

interface FormValues {
  customerId: string;
  title: string;
  intervalMonths: string;
  price: string;
  startDate: string;
  endDate: string;
  noticePeriodMonths: string;
  includesInspection: boolean;
  doorIds: string[];
  notes: string;
}

function alsTag(wert: string | null | undefined): string {
  return wert ? wert.slice(0, 10) : '';
}

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

function toValues(vertrag?: MaintenanceContract, kunde?: string): FormValues {
  return {
    customerId: vertrag?.customerId ?? kunde ?? '',
    title: vertrag?.title ?? '',
    intervalMonths: String(vertrag?.intervalMonths ?? DEFAULT_MAINTENANCE_INTERVAL_MONTHS),
    price: vertrag?.price != null ? String(vertrag.price) : '',
    startDate: alsTag(vertrag?.startDate) || heute(),
    endDate: alsTag(vertrag?.endDate),
    noticePeriodMonths: String(vertrag?.noticePeriodMonths ?? 3),
    includesInspection: vertrag?.includesInspection ?? true,
    doorIds: (vertrag?.doors ?? []).map((tor) => tor.id),
    notes: vertrag?.notes ?? '',
  };
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
 * Formular für einen Wartungsvertrag.
 *
 * Der Vertrag bündelt, was sonst einzeln geplant werden müsste: Er nennt die
 * abgedeckten Toranlagen, das Intervall und die Pauschale je Einsatz. Aus dem
 * Intervall errechnet die Anwendung den nächsten Termin, sobald eine Wartung
 * eingetragen wird.
 *
 * Der Haken „enthält die Prüfung nach ASR A1.7" ist nicht nur Beschreibung: An
 * ihm hängt, ob die wiederkehrende Prüfung als Vertragsleistung gilt oder
 * gesondert berechnet wird.
 */
export function ContractForm({
  vertrag,
  kunde,
}: {
  vertrag?: MaintenanceContract;
  kunde?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => toValues(vertrag, kunde));
  const [doors, setDoors] = useState<Door[]>([]);

  const save = useAction(async (payload: Record<string, unknown>) =>
    vertrag
      ? api.patch<MaintenanceContract>(`/maintenance-contracts/${vertrag.id}`, payload)
      : api.post<MaintenanceContract>('/maintenance-contracts', payload),
  );

  // Nur Anlagen des gewählten Kunden: Ein Vertrag über fremde Tore wäre ein
  // Fehler, den niemand bemerkt, bis die Wartung am falschen Ort ansteht.
  useEffect(() => {
    if (!values.customerId) {
      setDoors([]);
      return;
    }

    let aktuell = true;
    api
      .list<Door>('/doors', { customerId: values.customerId, pageSize: 200 })
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
        return { ...current, customerId: value as string, doorIds: [] };
      }
      return { ...current, [key]: value };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const result = await save.run({
      customerId: values.customerId,
      title: values.title,
      intervalMonths: zahl(values.intervalMonths),
      price: zahl(values.price),
      startDate: values.startDate,
      endDate: text(values.endDate),
      noticePeriodMonths: zahl(values.noticePeriodMonths),
      includesInspection: values.includesInspection,
      doorIds: values.doorIds,
      notes: text(values.notes),
    });

    if (result) router.push('/wartungsvertraege');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card title="Vertrag">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kunde" htmlFor="customerId" required>
            <CustomerPicker
              value={values.customerId}
              onChange={(id) => set('customerId', id)}
              required
            />
          </Field>

          <Field
            label="Bezeichnung"
            htmlFor="title"
            required
            hint="Steht auf dem Vertrag, z. B. „Wartung Industrietore Halle 1–3“."
          >
            <Input
              id="title"
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={300}
              required
            />
          </Field>

          <Field label="Vertragsbeginn" htmlFor="startDate" required>
            <Input
              id="startDate"
              type="date"
              value={values.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              required
            />
          </Field>

          <Field
            label="Vertragsende"
            htmlFor="endDate"
            hint="Leer lassen, solange der Vertrag unbefristet läuft."
          >
            <Input
              id="endDate"
              type="date"
              value={values.endDate}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card title="Leistung">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Intervall in Monaten"
            htmlFor="intervalMonths"
            hint="Daraus errechnet sich der nächste Wartungstermin."
          >
            <Input
              id="intervalMonths"
              type="number"
              min={1}
              max={120}
              value={values.intervalMonths}
              onChange={(e) => set('intervalMonths', e.target.value)}
            />
          </Field>

          <Field label="Pauschale je Einsatz in €" htmlFor="price">
            <Input
              id="price"
              type="number"
              min={0}
              step="0.01"
              value={values.price}
              onChange={(e) => set('price', e.target.value)}
            />
          </Field>

          <Field label="Kündigungsfrist in Monaten" htmlFor="noticePeriodMonths">
            <Input
              id="noticePeriodMonths"
              type="number"
              min={0}
              max={24}
              value={values.noticePeriodMonths}
              onChange={(e) => set('noticePeriodMonths', e.target.value)}
            />
          </Field>

          <div className="sm:col-span-3">
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-300"
                checked={values.includesInspection}
                onChange={(e) => set('includesInspection', e.target.checked)}
              />
              <span>
                Enthält die wiederkehrende Prüfung nach ASR A1.7
                <span className="block text-xs text-slate-500">
                  Ist der Haken weg, gilt die Prüfung nicht als Vertragsleistung und wird gesondert
                  berechnet.
                </span>
              </span>
            </label>
          </div>
        </div>
      </Card>

      <Card
        title="Abgedeckte Toranlagen"
        actions={
          <span className="text-sm text-slate-500">
            {values.doorIds.length === 0
              ? 'keine'
              : `${values.doorIds.length} ${values.doorIds.length === 1 ? 'Anlage' : 'Anlagen'}`}
          </span>
        }
      >
        {!values.customerId ? (
          <p className="text-sm text-slate-500">Bitte zuerst den Kunden wählen.</p>
        ) : doors.length === 0 ? (
          <p className="text-sm text-slate-500">
            Für diesen Kunden ist keine Toranlage erfasst. Anlagen werden unter „Toranlagen“
            angelegt.
          </p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {doors.map((tor) => (
              <label key={tor.id} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-300"
                  checked={values.doorIds.includes(tor.id)}
                  onChange={(event) =>
                    set(
                      'doorIds',
                      event.target.checked
                        ? [...values.doorIds, tor.id]
                        : values.doorIds.filter((eintrag) => eintrag !== tor.id),
                    )
                  }
                />
                <span>
                  {tor.doorNumber} · {tor.location}
                  <span className="block text-xs text-slate-500">{doorTypeLabels[tor.type]}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </Card>

      <Card title="Hinweise">
        <Field label="Notizen" htmlFor="notes">
          <textarea
            id="notes"
            className="input min-h-24"
            value={values.notes}
            onChange={(e) => set('notes', e.target.value)}
            maxLength={4000}
          />
        </Field>
      </Card>

      {save.error && <ErrorState message={save.error} />}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={save.loading} disabled={!values.customerId}>
          {vertrag ? 'Änderungen speichern' : 'Vertrag anlegen'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
