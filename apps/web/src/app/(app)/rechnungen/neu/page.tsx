'use client';

import { invoiceTypeLabels, toIsoDate } from '@garagentor/shared';
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
import type { Invoice, Order } from '@/lib/types';

/**
 * Eine Rechnung ohne Umweg über Angebot und Auftrag.
 *
 * Bisher entstand jede Rechnung durch Umwandlung. Das passt für das geplante
 * Geschäft, nicht für den halben Alltag: Eine Reparatur ohne Voranfrage, ein
 * Notdienst am Wochenende, eine kleine Materiallieferung – dafür gab es keinen
 * Weg.
 *
 * Der Auftragsbezug bleibt möglich und ist auch sinnvoll, wenn es einen gibt:
 * Daran hängt später die Nachkalkulation. Pflicht ist er nicht.
 */
function NeueRechnung() {
  const router = useRouter();
  const parameter = useSearchParams();

  const heute = new Date();
  const [customerId, setCustomerId] = useState(parameter.get('customerId') ?? '');
  const [orderId, setOrderId] = useState(parameter.get('orderId') ?? '');
  const [type, setType] = useState('RECHNUNG');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(toIsoDate(heute));
  const [dueDate, setDueDate] = useState('');
  const [serviceDate, setServiceDate] = useState(toIsoDate(heute));
  const [discountPercent, setDiscountPercent] = useState('0');
  const [skontoPercent, setSkontoPercent] = useState('');
  const [skontoDays, setSkontoDays] = useState('');
  const [introText, setIntroText] = useState(
    'vielen Dank für Ihren Auftrag. Wir erlauben uns, Ihnen folgende Leistungen in Rechnung zu stellen:',
  );
  const [outroText, setOutroText] = useState('');
  const [items, setItems] = useState<EditableLineItem[]>([emptyLineItem()]);
  const [orders, setOrders] = useState<Order[]>([]);

  const anlegen = useAction((payload: Record<string, unknown>) =>
    api.post<Invoice>('/invoices', payload),
  );

  // Aufträge desselben Kunden zur Auswahl – ein fremder Auftrag an der
  // Rechnung wäre ein Fehler, der erst in der Nachkalkulation auffällt.
  useEffect(() => {
    if (!customerId) {
      setOrders([]);
      return;
    }

    let aktuell = true;
    api
      .list<Order>('/orders', { customerId, pageSize: 100 })
      .then((seite) => {
        if (aktuell) setOrders(seite.items);
      })
      .catch(() => setOrders([]));

    return () => {
      aktuell = false;
    };
  }, [customerId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const ergebnis = await anlegen.run({
      customerId,
      orderId: orderId || undefined,
      type,
      subject,
      date: new Date(date).toISOString(),
      // Ohne Angabe rechnet der Server das Zahlungsziel des Kunden dazu.
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      serviceDate: serviceDate ? new Date(serviceDate).toISOString() : undefined,
      discountPercent: Number(discountPercent) || 0,
      skontoPercent: skontoPercent ? Number(skontoPercent) : undefined,
      skontoDays: skontoDays ? Number(skontoDays) : undefined,
      introText: introText || undefined,
      outroText: outroText || undefined,
      items: toApiItems(items),
    });

    if (ergebnis) router.push(`/rechnungen/${ergebnis.id}`);
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
                setOrderId('');
              }}
              required
            />
          </Field>

          <Field label="Rechnungsart" htmlFor="type">
            <Select id="type" value={type} onChange={(event) => setType(event.target.value)}>
              {Object.entries(invoiceTypeLabels).map(([wert, text]) => (
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
              placeholder="z. B. Reparatur Sectionaltor, Halle 2"
              maxLength={300}
              required
            />
          </Field>

          <Field
            label="Auftrag"
            htmlFor="orderId"
            hint={
              customerId && orders.length === 0
                ? 'Für diesen Kunden ist kein Auftrag erfasst – die Rechnung geht auch ohne.'
                : 'Freiwillig. Daran hängt später die Nachkalkulation.'
            }
          >
            <Select
              id="orderId"
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              disabled={orders.length === 0}
            >
              <option value="">Ohne Auftragsbezug</option>
              {orders.map((auftrag) => (
                <option key={auftrag.id} value={auftrag.id}>
                  {auftrag.orderNumber} · {auftrag.subject}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Leistungsdatum"
            htmlFor="serviceDate"
            hint="Pflichtangabe nach § 14 UStG, wenn es vom Rechnungsdatum abweicht."
          >
            <Input
              id="serviceDate"
              type="date"
              value={serviceDate}
              onChange={(event) => setServiceDate(event.target.value)}
            />
          </Field>

          <Field label="Rechnungsdatum" htmlFor="date" required>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </Field>

          <Field
            label="Fällig am"
            htmlFor="dueDate"
            hint="Leer lassen: Dann gilt das Zahlungsziel des Kunden."
          >
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
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
        <div className="grid gap-4 sm:grid-cols-3">
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
          <Field label="Skonto in Prozent" htmlFor="skontoPercent">
            <Input
              id="skontoPercent"
              type="number"
              min={0}
              max={20}
              step="0.01"
              value={skontoPercent}
              onChange={(event) => setSkontoPercent(event.target.value)}
              placeholder="ohne Skonto"
            />
          </Field>
          <Field label="Skontofrist in Tagen" htmlFor="skontoDays">
            <Input
              id="skontoDays"
              type="number"
              min={0}
              max={90}
              value={skontoDays}
              onChange={(event) => setSkontoDays(event.target.value)}
              placeholder="z. B. 14"
            />
          </Field>
        </div>
      </Card>

      <Card title="Anschreiben">
        <div className="space-y-4">
          <Field label="Einleitungstext" htmlFor="introText">
            <textarea
              id="introText"
              className="input min-h-20"
              value={introText}
              onChange={(event) => setIntroText(event.target.value)}
              maxLength={4000}
            />
          </Field>
          <Field label="Schlusstext" htmlFor="outroText">
            <textarea
              id="outroText"
              className="input min-h-20"
              value={outroText}
              onChange={(event) => setOutroText(event.target.value)}
              maxLength={4000}
            />
          </Field>
        </div>
      </Card>

      {anlegen.error && <ErrorState message={anlegen.error} />}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={anlegen.loading} disabled={!customerId || !subject.trim()}>
          Rechnung anlegen
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

export default function NewInvoicePage() {
  return (
    <>
      <PageHeader
        title="Rechnung erstellen"
        subtitle="Die Rechnungsnummer wird beim Anlegen vergeben. Die Rechnung bleibt Entwurf, bis sie versendet wird."
      />
      <Suspense fallback={<LoadingState />}>
        <NeueRechnung />
      </Suspense>
    </>
  );
}
