'use client';

import { orderTypeLabels, toIsoDate } from '@garagentor/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { CustomerPicker } from '@/components/customer-picker';
import {
  emptyLineItem,
  LineItemEditor,
  toApiItems,
  type EditableLineItem,
} from '@/components/line-item-editor';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction } from '@/lib/hooks';
import type { Customer, Order, Site } from '@/lib/types';

/**
 * Ein Auftrag ohne vorheriges Angebot.
 *
 * Der geplante Weg führt über das Angebot – für Montagen ist das richtig. Ein
 * Notdienst oder eine Reparatur nach Anruf hat aber kein Angebot, und ohne
 * diesen Weg blieb dafür nur, eines nachträglich zu erfinden.
 */
function NeuerAuftrag() {
  const router = useRouter();
  const parameter = useSearchParams();

  const [customerId, setCustomerId] = useState(parameter.get('customerId') ?? '');
  const [siteId, setSiteId] = useState('');
  const [type, setType] = useState('MONTAGE');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [customerReference, setCustomerReference] = useState('');
  const [plannedStart, setPlannedStart] = useState(toIsoDate(new Date()));
  const [plannedEnd, setPlannedEnd] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<EditableLineItem[]>([emptyLineItem()]);
  const [sites, setSites] = useState<Site[]>([]);

  const anlegen = useAction((payload: Record<string, unknown>) =>
    api.post<Order>('/orders', payload),
  );

  useEffect(() => {
    if (!customerId) {
      setSites([]);
      return;
    }

    let aktuell = true;
    api
      .get<Customer>(`/customers/${customerId}`)
      .then((kunde) => {
        if (aktuell) setSites(kunde.sites ?? []);
      })
      .catch(() => setSites([]));

    return () => {
      aktuell = false;
    };
  }, [customerId]);

  const endeVorAnfang = Boolean(
    plannedStart && plannedEnd && new Date(plannedEnd) < new Date(plannedStart),
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const ergebnis = await anlegen.run({
      customerId,
      siteId: siteId || undefined,
      type,
      subject,
      description: description || undefined,
      customerReference: customerReference || undefined,
      plannedStart: plannedStart ? new Date(plannedStart).toISOString() : undefined,
      plannedEnd: plannedEnd ? new Date(plannedEnd).toISOString() : undefined,
      discountPercent: Number(discountPercent) || 0,
      notes: notes || undefined,
      items: toApiItems(items),
    });

    if (ergebnis) router.push(`/auftraege/${ergebnis.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card title="Kopfdaten">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kunde" htmlFor="customerId" required>
            <CustomerPicker
              value={customerId}
              onChange={(id) => {
                setCustomerId(id);
                setSiteId('');
              }}
              required
            />
          </Field>

          <Field label="Auftragsart" htmlFor="type">
            <Select id="type" value={type} onChange={(event) => setType(event.target.value)}>
              {Object.entries(orderTypeLabels).map(([wert, text]) => (
                <option key={wert} value={wert}>
                  {text}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Betreff" htmlFor="subject" className="sm:col-span-2" required>
            <Input
              id="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="z. B. Antriebstausch Rolltor, Halle 3"
              maxLength={300}
              required
            />
          </Field>

          <Field
            label="Objekt"
            htmlFor="siteId"
            hint={
              customerId && sites.length === 0
                ? 'Für diesen Kunden ist kein Objekt hinterlegt.'
                : undefined
            }
          >
            <Select
              id="siteId"
              value={siteId}
              onChange={(event) => setSiteId(event.target.value)}
              disabled={sites.length === 0}
            >
              <option value="">Ohne Objekt</option>
              {sites.map((objekt) => (
                <option key={objekt.id} value={objekt.id}>
                  {objekt.name} · {objekt.zip} {objekt.city}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Bestellnummer des Kunden"
            htmlFor="customerReference"
            hint="Verlangen größere Auftraggeber auf der Rechnung."
          >
            <Input
              id="customerReference"
              value={customerReference}
              onChange={(event) => setCustomerReference(event.target.value)}
              maxLength={100}
            />
          </Field>

          <Field label="Geplanter Beginn" htmlFor="plannedStart">
            <Input
              id="plannedStart"
              type="date"
              value={plannedStart}
              onChange={(event) => setPlannedStart(event.target.value)}
            />
          </Field>

          <Field
            label="Geplantes Ende"
            htmlFor="plannedEnd"
            error={endeVorAnfang ? 'Das Ende liegt vor dem Beginn.' : undefined}
          >
            <Input
              id="plannedEnd"
              type="date"
              value={plannedEnd}
              onChange={(event) => setPlannedEnd(event.target.value)}
            />
          </Field>

          <Field label="Beschreibung" htmlFor="description" className="sm:col-span-2">
            <textarea
              id="description"
              className="input min-h-20"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={4000}
              placeholder="Was zu tun ist, Zugang, Besonderheiten vor Ort."
            />
          </Field>
        </div>
      </Card>

      <Card title="Positionen">
        <LineItemEditor
          items={items}
          onChange={setItems}
          discountPercent={Number(discountPercent) || 0}
        />
      </Card>

      <Card title="Konditionen">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Gesamtrabatt in Prozent"
            htmlFor="discountPercent"
            hint="Wird anteilig auf die Steuersätze verteilt."
          >
            <Input
              id="discountPercent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={discountPercent}
              onChange={(event) => setDiscountPercent(event.target.value)}
            />
          </Field>
          <Field label="Interne Notizen" htmlFor="notes">
            <textarea
              id="notes"
              className="input min-h-20"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={4000}
            />
          </Field>
        </div>
      </Card>

      {anlegen.error && <ErrorState message={anlegen.error} />}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          loading={anlegen.loading}
          disabled={!customerId || !subject.trim() || endeVorAnfang}
        >
          Auftrag anlegen
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

export default function NewOrderPage() {
  return (
    <>
      <PageHeader
        title="Auftrag erstellen"
        subtitle="Für Arbeiten ohne vorheriges Angebot – Notdienst, Reparatur nach Anruf."
      />
      <Suspense fallback={<LoadingState />}>
        <NeuerAuftrag />
      </Suspense>
    </>
  );
}
