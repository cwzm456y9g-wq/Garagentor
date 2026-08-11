'use client';

import { appointmentTypeLabels } from '@garagentor/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { CustomerPicker } from '@/components/customer-picker';
import { EmployeeCheckboxes } from '@/components/employee-picker';
import { Button, Card, ErrorState, Field, Input, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction } from '@/lib/hooks';
import type { Appointment, Customer, Site } from '@/lib/types';

interface FormValues {
  title: string;
  type: string;
  start: string;
  end: string;
  allDay: boolean;
  customerId: string;
  siteId: string;
  location: string;
  description: string;
  assigneeIds: string[];
}

/** ISO-Zeitstempel in die Form, die ein `datetime-local`-Feld erwartet. */
function alsZeitpunkt(wert: string | null | undefined): string {
  return wert ? wert.slice(0, 16) : '';
}

/** Der nächste volle Stundenbeginn – als brauchbarer Vorschlag. */
function naechsteStunde(versatzStunden = 1): string {
  const zeit = new Date();
  zeit.setMinutes(0, 0, 0);
  zeit.setHours(zeit.getHours() + versatzStunden);
  // Der lokale Zeitversatz muss heraus, sonst springt die Anzeige.
  return new Date(zeit.getTime() - zeit.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function toValues(termin?: Appointment): FormValues {
  return {
    title: termin?.title ?? '',
    type: termin?.type ?? 'MONTAGE',
    start: alsZeitpunkt(termin?.start) || naechsteStunde(1),
    end: alsZeitpunkt(termin?.end) || naechsteStunde(3),
    allDay: termin?.allDay ?? false,
    customerId: termin?.customer?.id ?? '',
    siteId: termin?.site?.id ?? '',
    location: termin?.location ?? '',
    description: termin?.description ?? '',
    assigneeIds: (termin?.assignees ?? []).map((person) => person.id),
  };
}

function text(wert: string): string | undefined {
  return wert.trim() || undefined;
}

/**
 * Formular für einen Termin – den Arbeitseinsatz, dem Monteure zugeordnet
 * werden.
 *
 * Die Einteilung ist der eigentliche Zweck: Am Termin hängt, wer wann wo ist.
 *
 * Doppelbelegungen blockiert der Server nicht – kurzfristige Umplanungen sind
 * Alltag –, er meldet sie aber in der Antwort zurück. Dieses Formular zeigt sie
 * danach an, statt stillschweigend weiterzuspringen: Sonst wäre es das
 * Schlechteste von beidem, nämlich doppelt eingeteilt und niemand weiß es.
 */
export function AppointmentForm({ termin }: { termin?: Appointment }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => toValues(termin));
  const [sites, setSites] = useState<Site[]>([]);
  const [ueberschneidungen, setUeberschneidungen] = useState<NonNullable<Appointment['conflicts']>>(
    [],
  );

  const save = useAction(async (payload: Record<string, unknown>) =>
    termin
      ? api.patch<Appointment>(`/appointments/${termin.id}`, payload)
      : api.post<Appointment>('/appointments', payload),
  );

  useEffect(() => {
    if (!values.customerId) {
      setSites([]);
      return;
    }

    let aktuell = true;
    api
      .get<Customer>(`/customers/${values.customerId}`)
      .then((kunde) => {
        if (aktuell) setSites(kunde.sites ?? []);
      })
      .catch(() => setSites([]));

    return () => {
      aktuell = false;
    };
  }, [values.customerId]);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => {
      if (key === 'customerId' && value !== current.customerId) {
        return { ...current, customerId: value as string, siteId: '' };
      }
      return { ...current, [key]: value };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const result = await save.run({
      title: values.title,
      type: values.type,
      start: new Date(values.start).toISOString(),
      end: new Date(values.end).toISOString(),
      allDay: values.allDay,
      customerId: text(values.customerId),
      siteId: text(values.siteId),
      location: text(values.location),
      description: text(values.description),
      assigneeIds: values.assigneeIds,
    });

    if (!result) return;

    // Der Server blockiert Doppelbelegungen nicht – kurzfristige Umplanungen
    // sind im Tagesgeschäft üblich –, meldet sie aber zurück. Sie hier
    // wegzuwerfen und stillschweigend weiterzuspringen wäre das Schlechteste
    // von beidem: eingeteilt ist er doppelt, und niemand weiß es.
    if (result.conflicts && result.conflicts.length > 0) {
      setUeberschneidungen(result.conflicts);
      return;
    }

    router.push('/termine');
  }

  const endeVorAnfang = Boolean(
    values.start && values.end && new Date(values.end) <= new Date(values.start),
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card title="Einsatz">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bezeichnung" htmlFor="title" className="sm:col-span-2" required>
            <Input
              id="title"
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={300}
              placeholder="Wartung Sectionaltor, Halle 1"
              required
            />
          </Field>

          <Field label="Art" htmlFor="type">
            <Select id="type" value={values.type} onChange={(e) => set('type', e.target.value)}>
              {Object.entries(appointmentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex items-end">
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={values.allDay}
                onChange={(e) => set('allDay', e.target.checked)}
              />
              Ganztägig
            </label>
          </div>

          <Field label="Beginn" htmlFor="start" required>
            <Input
              id="start"
              type="datetime-local"
              value={values.start}
              onChange={(e) => set('start', e.target.value)}
              required
            />
          </Field>
          <Field
            label="Ende"
            htmlFor="end"
            required
            error={endeVorAnfang ? 'Das Ende liegt vor dem Beginn.' : undefined}
          >
            <Input
              id="end"
              type="datetime-local"
              value={values.end}
              onChange={(e) => set('end', e.target.value)}
              required
            />
          </Field>
        </div>
      </Card>

      <Card title="Wohin">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kunde" htmlFor="customerId">
            <CustomerPicker value={values.customerId} onChange={(id) => set('customerId', id)} />
          </Field>
          <Field label="Objekt" htmlFor="siteId">
            <Select
              id="siteId"
              value={values.siteId}
              onChange={(e) => set('siteId', e.target.value)}
              disabled={sites.length === 0}
            >
              <option value="">Ohne Objekt</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} · {site.zip} {site.city}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Ort"
            htmlFor="location"
            className="sm:col-span-2"
            hint="Freitext, falls kein Objekt hinterlegt ist."
          >
            <Input
              id="location"
              value={values.location}
              onChange={(e) => set('location', e.target.value)}
              maxLength={300}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Eingeteilt"
        actions={
          <span className="text-sm text-slate-500">
            {values.assigneeIds.length === 0
              ? 'niemand'
              : `${values.assigneeIds.length} ${values.assigneeIds.length === 1 ? 'Person' : 'Personen'}`}
          </span>
        }
      >
        <EmployeeCheckboxes
          values={values.assigneeIds}
          onChange={(ids) => set('assigneeIds', ids)}
        />
        <p className="mt-3 text-xs text-slate-500">
          Wer hier steht, findet den Einsatz unter „Mein Tag“. Ist jemand zur selben Zeit schon
          eingeplant, wird das nach dem Speichern angezeigt – blockiert wird es nicht.
        </p>
      </Card>

      <Card title="Hinweise">
        <Field label="Beschreibung" htmlFor="description">
          <textarea
            id="description"
            className="input min-h-24"
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={4000}
            placeholder="Zufahrt über Hof, Schlüssel beim Pförtner."
          />
        </Field>
      </Card>

      {save.error && <ErrorState message={save.error} />}

      {ueberschneidungen.length > 0 ? (
        <Card title="Der Termin steht – aber jemand ist doppelt eingeteilt">
          <p className="text-sm text-slate-700">
            Gespeichert wurde er trotzdem: Kurzfristige Umplanungen sind Alltag, und die Anwendung
            entscheidet das nicht anstelle der Disposition. Zur selben Zeit läuft bereits:
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {ueberschneidungen.map((termin) => (
              <li key={termin.id} className="flex flex-wrap gap-x-2 text-slate-700">
                <span className="font-medium text-slate-900">{termin.title}</span>
                <span className="tabular text-slate-500">
                  {new Date(termin.start).toLocaleString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  bis{' '}
                  {new Date(termin.end).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-3">
            <Button onClick={() => router.push('/termine')}>Zur Terminliste</Button>
            <Button variant="secondary" onClick={() => setUeberschneidungen([])}>
              Einteilung ändern
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex items-center gap-3">
          <Button type="submit" loading={save.loading} disabled={endeVorAnfang}>
            {termin ? 'Änderungen speichern' : 'Termin anlegen'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Abbrechen
          </Button>
        </div>
      )}
    </form>
  );
}
