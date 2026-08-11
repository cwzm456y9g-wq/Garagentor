'use client';

import { employmentTypeLabels } from '@garagentor/shared';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Card, ErrorState, Field, Input, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction } from '@/lib/hooks';
import type { Employee } from '@/lib/types';

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  position: string;
  employmentType: string;
  hireDate: string;
  exitDate: string;
  weeklyHours: string;
  hourlyCost: string;
  hourlyRate: string;
  vacationDays: string;
  street: string;
  zip: string;
  city: string;
  birthDate: string;
  notes: string;
  active: boolean;
}

function alsTag(wert: string | null | undefined): string {
  return wert ? wert.slice(0, 10) : '';
}

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

function toValues(person?: Employee): FormValues {
  return {
    firstName: person?.firstName ?? '',
    lastName: person?.lastName ?? '',
    email: person?.email ?? '',
    phone: person?.phone ?? '',
    mobile: person?.mobile ?? '',
    position: person?.position ?? '',
    employmentType: person?.employmentType ?? 'VOLLZEIT',
    hireDate: alsTag(person?.hireDate) || heute(),
    exitDate: alsTag(person?.exitDate),
    weeklyHours: person ? String(person.weeklyHours) : '40',
    hourlyCost: person?.hourlyCost != null ? String(person.hourlyCost) : '',
    hourlyRate: person?.hourlyRate != null ? String(person.hourlyRate) : '',
    vacationDays: person ? String(person.vacationDays) : '30',
    street: person?.street ?? '',
    zip: person?.zip ?? '',
    city: person?.city ?? '',
    birthDate: alsTag(person?.birthDate),
    notes: person?.notes ?? '',
    active: person?.active ?? true,
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
 * Formular für Mitarbeiter.
 *
 * Zwei Stundensätze, und der Unterschied ist wichtig: `hourlyCost` ist das,
 * was die Stunde den Betrieb kostet, `hourlyRate` das, was dem Kunden dafür
 * berechnet wird. Die Nachkalkulation lebt von der Differenz – wer nur einen
 * Wert pflegt, sieht am Ende nicht, ob ein Einsatz getragen hat.
 *
 * Die Personalnummer vergibt die Anwendung selbst, wie überall.
 */
export function EmployeeForm({ employee }: { employee?: Employee }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => toValues(employee));

  const save = useAction(async (payload: Record<string, unknown>) =>
    employee
      ? api.patch<Employee>(`/employees/${employee.id}`, payload)
      : api.post<Employee>('/employees', payload),
  );

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const result = await save.run({
      firstName: values.firstName,
      lastName: values.lastName,
      email: text(values.email),
      phone: text(values.phone),
      mobile: text(values.mobile),
      position: text(values.position),
      employmentType: values.employmentType,
      hireDate: values.hireDate,
      exitDate: text(values.exitDate),
      weeklyHours: zahl(values.weeklyHours),
      hourlyCost: zahl(values.hourlyCost),
      hourlyRate: zahl(values.hourlyRate),
      vacationDays: zahl(values.vacationDays),
      street: text(values.street),
      zip: text(values.zip),
      city: text(values.city),
      birthDate: text(values.birthDate),
      notes: text(values.notes),
      active: values.active,
    });

    if (result) router.push(`/personal/${result.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card title="Person">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vorname" htmlFor="firstName" required>
            <Input
              id="firstName"
              value={values.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              maxLength={100}
              required
            />
          </Field>
          <Field label="Nachname" htmlFor="lastName" required>
            <Input
              id="lastName"
              value={values.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              maxLength={100}
              required
            />
          </Field>
          <Field label="Funktion" htmlFor="position" hint="Etwa „Monteur“ oder „Servicetechniker“.">
            <Input
              id="position"
              value={values.position}
              onChange={(e) => set('position', e.target.value)}
              maxLength={100}
            />
          </Field>
          <Field label="Geburtsdatum" htmlFor="birthDate">
            <Input
              id="birthDate"
              type="date"
              value={values.birthDate}
              onChange={(e) => set('birthDate', e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card title="Erreichbarkeit">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-Mail" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={(e) => set('email', e.target.value)}
              maxLength={200}
            />
          </Field>
          <Field label="Telefon" htmlFor="phone">
            <Input
              id="phone"
              value={values.phone}
              onChange={(e) => set('phone', e.target.value)}
              maxLength={50}
            />
          </Field>
          <Field label="Mobil" htmlFor="mobile">
            <Input
              id="mobile"
              value={values.mobile}
              onChange={(e) => set('mobile', e.target.value)}
              maxLength={50}
            />
          </Field>
          <Field label="Straße" htmlFor="street">
            <Input
              id="street"
              value={values.street}
              onChange={(e) => set('street', e.target.value)}
              maxLength={200}
            />
          </Field>
          <Field label="PLZ" htmlFor="zip">
            <Input
              id="zip"
              value={values.zip}
              onChange={(e) => set('zip', e.target.value)}
              maxLength={10}
            />
          </Field>
          <Field label="Ort" htmlFor="city">
            <Input
              id="city"
              value={values.city}
              onChange={(e) => set('city', e.target.value)}
              maxLength={100}
            />
          </Field>
        </div>
      </Card>

      <Card title="Beschäftigung">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Art" htmlFor="employmentType">
            <Select
              id="employmentType"
              value={values.employmentType}
              onChange={(e) => set('employmentType', e.target.value)}
            >
              {Object.entries(employmentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Eintritt" htmlFor="hireDate" required>
            <Input
              id="hireDate"
              type="date"
              value={values.hireDate}
              onChange={(e) => set('hireDate', e.target.value)}
              required
            />
          </Field>
          <Field
            label="Austritt"
            htmlFor="exitDate"
            hint="Leer lassen, solange die Person beschäftigt ist."
          >
            <Input
              id="exitDate"
              type="date"
              value={values.exitDate}
              onChange={(e) => set('exitDate', e.target.value)}
            />
          </Field>

          <Field label="Wochenstunden" htmlFor="weeklyHours">
            <Input
              id="weeklyHours"
              type="number"
              min={0}
              max={60}
              step="0.5"
              value={values.weeklyHours}
              onChange={(e) => set('weeklyHours', e.target.value)}
            />
          </Field>
          <Field label="Urlaubstage im Jahr" htmlFor="vacationDays">
            <Input
              id="vacationDays"
              type="number"
              min={0}
              max={365}
              value={values.vacationDays}
              onChange={(e) => set('vacationDays', e.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={values.active}
                onChange={(e) => set('active', e.target.checked)}
              />
              Aktiv – kann eingeteilt werden
            </label>
          </div>
        </div>
      </Card>

      <Card title="Sätze">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Interner Stundensatz in €"
            htmlFor="hourlyCost"
            hint="Was die Stunde den Betrieb kostet. Nur für die Nachkalkulation, erscheint auf keinem Beleg."
          >
            <Input
              id="hourlyCost"
              type="number"
              min={0}
              step="0.01"
              value={values.hourlyCost}
              onChange={(e) => set('hourlyCost', e.target.value)}
            />
          </Field>
          <Field
            label="Verrechnungssatz in €"
            htmlFor="hourlyRate"
            hint="Was dem Kunden für die Stunde berechnet wird."
          >
            <Input
              id="hourlyRate"
              type="number"
              min={0}
              step="0.01"
              value={values.hourlyRate}
              onChange={(e) => set('hourlyRate', e.target.value)}
            />
          </Field>
          <Field label="Notizen" htmlFor="notes" className="sm:col-span-2">
            <textarea
              id="notes"
              className="input min-h-20"
              value={values.notes}
              onChange={(e) => set('notes', e.target.value)}
              maxLength={4000}
            />
          </Field>
        </div>
      </Card>

      {save.error && <ErrorState message={save.error} />}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={save.loading}>
          {employee ? 'Änderungen speichern' : 'Mitarbeiter anlegen'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
