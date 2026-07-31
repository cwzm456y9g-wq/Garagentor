'use client';

import { customerTypeLabels, salutationLabels } from '@garagentor/shared';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Card, ErrorState, Field, Input, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction } from '@/lib/hooks';
import type { Customer } from '@/lib/types';

interface FormValues {
  type: string;
  salutation: string;
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  vatId: string;
  paymentTermsDays: string;
  discountPercent: string;
  notes: string;
}

function toValues(customer?: Customer): FormValues {
  return {
    type: customer?.type ?? 'PRIVAT',
    salutation: customer?.salutation ?? '',
    companyName: customer?.companyName ?? '',
    firstName: customer?.firstName ?? '',
    lastName: customer?.lastName ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    mobile: customer?.mobile ?? '',
    vatId: customer?.vatId ?? '',
    paymentTermsDays: String(customer?.paymentTermsDays ?? 14),
    discountPercent: String(customer?.discountPercent ?? 0),
    notes: customer?.notes ?? '',
  };
}

/** Formular zum Anlegen und Ändern eines Kunden. */
export function CustomerForm({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => toValues(customer));
  const isPrivate = values.type === 'PRIVAT';

  const save = useAction(async (payload: Record<string, unknown>) =>
    customer
      ? api.patch<Customer>(`/customers/${customer.id}`, payload)
      : api.post<Customer>('/customers', payload),
  );

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const result = await save.run({
      type: values.type,
      salutation: values.salutation || undefined,
      // Nur das je nach Kundenart maßgebliche Namensfeld wird übermittelt.
      companyName: isPrivate ? undefined : values.companyName,
      firstName: values.firstName || undefined,
      lastName: values.lastName || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      mobile: values.mobile || undefined,
      vatId: values.vatId || undefined,
      paymentTermsDays: Number(values.paymentTermsDays),
      discountPercent: Number(values.discountPercent),
      notes: values.notes || undefined,
    });

    if (result) router.push(`/kunden/${result.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card title="Stammdaten">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kundenart" htmlFor="type" required>
            <Select id="type" value={values.type} onChange={(e) => set('type', e.target.value)}>
              {Object.entries(customerTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Anrede" htmlFor="salutation">
            <Select
              id="salutation"
              value={values.salutation}
              onChange={(e) => set('salutation', e.target.value)}
            >
              <option value="">Ohne Angabe</option>
              {Object.entries(salutationLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          {!isPrivate && (
            <Field label="Firmenname" htmlFor="companyName" className="sm:col-span-2" required>
              <Input
                id="companyName"
                value={values.companyName}
                onChange={(e) => set('companyName', e.target.value)}
                required
              />
            </Field>
          )}

          <Field label="Vorname" htmlFor="firstName">
            <Input
              id="firstName"
              value={values.firstName}
              onChange={(e) => set('firstName', e.target.value)}
            />
          </Field>

          <Field label="Nachname" htmlFor="lastName" required={isPrivate}>
            <Input
              id="lastName"
              value={values.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              required={isPrivate}
            />
          </Field>
        </div>
      </Card>

      <Card title="Kontakt">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-Mail" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
          <Field label="Telefon" htmlFor="phone">
            <Input id="phone" value={values.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Mobil" htmlFor="mobile">
            <Input
              id="mobile"
              value={values.mobile}
              onChange={(e) => set('mobile', e.target.value)}
            />
          </Field>
          <Field label="USt-IdNr." htmlFor="vatId">
            <Input id="vatId" value={values.vatId} onChange={(e) => set('vatId', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card title="Konditionen">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Zahlungsziel in Tagen" htmlFor="paymentTermsDays">
            <Input
              id="paymentTermsDays"
              type="number"
              min={0}
              max={365}
              value={values.paymentTermsDays}
              onChange={(e) => set('paymentTermsDays', e.target.value)}
            />
          </Field>
          <Field label="Kundenrabatt in Prozent" htmlFor="discountPercent">
            <Input
              id="discountPercent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={values.discountPercent}
              onChange={(e) => set('discountPercent', e.target.value)}
            />
          </Field>
          <Field label="Notizen" htmlFor="notes" className="sm:col-span-2">
            <textarea
              id="notes"
              className="input min-h-24"
              value={values.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Field>
        </div>
      </Card>

      {save.error && <ErrorState message={save.error} />}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={save.loading}>
          {customer ? 'Änderungen speichern' : 'Kunde anlegen'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
