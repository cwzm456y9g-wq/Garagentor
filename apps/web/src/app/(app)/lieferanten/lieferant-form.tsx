'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Card, ErrorState, Field, Input } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction } from '@/lib/hooks';
import type { Supplier } from '@/lib/types';

interface FormValues {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  street: string;
  zip: string;
  city: string;
  customerNumber: string;
  vatId: string;
  paymentTermsDays: string;
  discountPercent: string;
  notes: string;
  active: boolean;
}

function toValues(lieferant?: Supplier): FormValues {
  return {
    name: lieferant?.name ?? '',
    contactName: lieferant?.contactName ?? '',
    email: lieferant?.email ?? '',
    phone: lieferant?.phone ?? '',
    street: lieferant?.street ?? '',
    zip: lieferant?.zip ?? '',
    city: lieferant?.city ?? '',
    customerNumber: lieferant?.customerNumber ?? '',
    vatId: lieferant?.vatId ?? '',
    paymentTermsDays: String(lieferant?.paymentTermsDays ?? 30),
    discountPercent: String(lieferant?.discountPercent ?? 0),
    notes: lieferant?.notes ?? '',
    active: lieferant?.active ?? true,
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
 * Formular für einen Lieferanten.
 *
 * Zahlungsziel und Skonto stehen hier, weil sie zum Lieferanten gehören und
 * nicht zur einzelnen Bestellung: Sie gelten so lange, bis sie neu verhandelt
 * werden, und die Bestellung übernimmt sie beim Anlegen.
 *
 * Die eigene Kundennummer beim Lieferanten ist keine Kleinigkeit – ohne sie
 * ordnet die Gegenseite eine Bestellung im Zweifel dem falschen Konto zu.
 */
export function SupplierForm({ lieferant }: { lieferant?: Supplier }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => toValues(lieferant));

  const save = useAction(async (payload: Record<string, unknown>) =>
    lieferant
      ? api.patch<Supplier>(`/suppliers/${lieferant.id}`, payload)
      : api.post<Supplier>('/suppliers', payload),
  );

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const ergebnis = await save.run({
      name: values.name,
      contactName: text(values.contactName),
      email: text(values.email),
      phone: text(values.phone),
      street: text(values.street),
      zip: text(values.zip),
      city: text(values.city),
      customerNumber: text(values.customerNumber),
      vatId: text(values.vatId),
      paymentTermsDays: zahl(values.paymentTermsDays),
      discountPercent: zahl(values.discountPercent),
      notes: text(values.notes),
      active: values.active,
    });

    if (ergebnis) router.push('/lieferanten');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card title="Lieferant">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" className="sm:col-span-2" required>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              maxLength={200}
              required
            />
          </Field>

          <Field label="Ansprechpartner" htmlFor="contactName">
            <Input
              id="contactName"
              value={values.contactName}
              onChange={(e) => set('contactName', e.target.value)}
              maxLength={200}
            />
          </Field>

          <Field label="Telefon" htmlFor="phone">
            <Input
              id="phone"
              type="tel"
              value={values.phone}
              onChange={(e) => set('phone', e.target.value)}
              maxLength={50}
            />
          </Field>

          <Field
            label="E-Mail"
            htmlFor="email"
            hint="Dorthin geht später die Bestellung."
            className="sm:col-span-2"
          >
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={(e) => set('email', e.target.value)}
              maxLength={200}
            />
          </Field>
        </div>
      </Card>

      <Card title="Anschrift">
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="Straße und Hausnummer" htmlFor="street" className="sm:col-span-6">
            <Input
              id="street"
              value={values.street}
              onChange={(e) => set('street', e.target.value)}
              maxLength={200}
            />
          </Field>
          <Field label="PLZ" htmlFor="zip" className="sm:col-span-2">
            <Input
              id="zip"
              value={values.zip}
              onChange={(e) => set('zip', e.target.value)}
              maxLength={10}
              inputMode="numeric"
            />
          </Field>
          <Field label="Ort" htmlFor="city" className="sm:col-span-4">
            <Input
              id="city"
              value={values.city}
              onChange={(e) => set('city', e.target.value)}
              maxLength={100}
            />
          </Field>
        </div>
      </Card>

      <Card title="Konditionen">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Unsere Kundennummer dort"
            htmlFor="customerNumber"
            hint="Steht auf der Bestellung – ohne sie sucht die Gegenseite das Konto."
          >
            <Input
              id="customerNumber"
              value={values.customerNumber}
              onChange={(e) => set('customerNumber', e.target.value)}
              maxLength={50}
            />
          </Field>

          <Field label="Umsatzsteuer-Identifikationsnummer" htmlFor="vatId">
            <Input
              id="vatId"
              value={values.vatId}
              onChange={(e) => set('vatId', e.target.value)}
              maxLength={30}
              placeholder="DE123456789"
            />
          </Field>

          <Field label="Zahlungsziel in Tagen" htmlFor="paymentTermsDays">
            <Input
              id="paymentTermsDays"
              type="number"
              min={0}
              max={365}
              step="1"
              value={values.paymentTermsDays}
              onChange={(e) => set('paymentTermsDays', e.target.value)}
            />
          </Field>

          <Field
            label="Skonto in Prozent"
            htmlFor="discountPercent"
            hint="Was der Lieferant uns bei schneller Zahlung nachlässt."
          >
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
              className="input min-h-20"
              value={values.notes}
              onChange={(e) => set('notes', e.target.value)}
              maxLength={4000}
              placeholder="Liefertage, Mindestbestellwert, Frachtkosten."
            />
          </Field>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={values.active}
                onChange={(e) => set('active', e.target.checked)}
              />
              Aktiv – erscheint in der Auswahl am Artikel und bei Bestellungen
            </label>
          </div>
        </div>
      </Card>

      {save.error && <ErrorState message={save.error} />}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={save.loading} disabled={!values.name.trim()}>
          {lieferant ? 'Änderungen speichern' : 'Lieferant anlegen'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
