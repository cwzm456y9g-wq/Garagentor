'use client';

import { addDays, DEFAULT_QUOTE_VALIDITY_DAYS, toIsoDate } from '@garagentor/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { CustomerPicker } from '@/components/customer-picker';
import {
  emptyLineItem,
  LineItemEditor,
  toApiItems,
  type EditableLineItem,
} from '@/components/line-item-editor';
import { Button, Card, ErrorState, Field, Input, LoadingState, PageHeader } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction } from '@/lib/hooks';
import type { Quote } from '@/lib/types';

function NewQuoteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const today = new Date();
  const [customerId, setCustomerId] = useState(searchParams.get('customerId') ?? '');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(toIsoDate(today));
  const [validUntil, setValidUntil] = useState(
    toIsoDate(addDays(today, DEFAULT_QUOTE_VALIDITY_DAYS)),
  );
  const [discountPercent, setDiscountPercent] = useState('0');
  const [introText, setIntroText] = useState(
    'vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:',
  );
  const [outroText, setOutroText] = useState('');
  const [items, setItems] = useState<EditableLineItem[]>([emptyLineItem()]);

  const create = useAction((payload: Record<string, unknown>) =>
    api.post<Quote>('/quotes', payload),
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const result = await create.run({
      customerId,
      subject,
      date: new Date(date).toISOString(),
      validUntil: new Date(validUntil).toISOString(),
      discountPercent: Number(discountPercent) || 0,
      introText: introText || undefined,
      outroText: outroText || undefined,
      items: toApiItems(items),
    });

    if (result) router.push(`/angebote/${result.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card title="Kopfdaten">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kunde" htmlFor="customerId" required>
            <CustomerPicker value={customerId} onChange={setCustomerId} required />
          </Field>
          <Field label="Betreff" htmlFor="subject" required>
            <Input
              id="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="z. B. Austausch Sectionaltor inkl. Antrieb"
              required
            />
          </Field>
          <Field label="Angebotsdatum" htmlFor="date" required>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </Field>
          <Field label="Gültig bis" htmlFor="validUntil" required>
            <Input
              id="validUntil"
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              required
            />
          </Field>
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
        </div>
      </Card>

      <Card title="Positionen">
        <LineItemEditor
          items={items}
          onChange={setItems}
          discountPercent={Number(discountPercent) || 0}
          allowOptional
        />
      </Card>

      <Card title="Anschreiben">
        <div className="space-y-4">
          <Field label="Einleitungstext" htmlFor="introText">
            <textarea
              id="introText"
              className="input min-h-20"
              value={introText}
              onChange={(event) => setIntroText(event.target.value)}
            />
          </Field>
          <Field label="Schlusstext" htmlFor="outroText">
            <textarea
              id="outroText"
              className="input min-h-20"
              value={outroText}
              onChange={(event) => setOutroText(event.target.value)}
            />
          </Field>
        </div>
      </Card>

      {create.error && <ErrorState message={create.error} />}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={create.loading}>
          Angebot anlegen
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

export default function NewQuotePage() {
  return (
    <>
      <PageHeader
        title="Angebot erstellen"
        subtitle="Die Angebotsnummer wird beim Speichern vergeben."
      />
      <Suspense fallback={<LoadingState />}>
        <NewQuoteForm />
      </Suspense>
    </>
  );
}
