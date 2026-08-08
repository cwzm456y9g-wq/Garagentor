'use client';

import {
  customerDisplayName,
  dunningLevelLabels,
  formatCurrency,
  formatDate,
  invoiceTypeLabels,
  paymentMethodLabels,
  toIsoDate,
  type PaymentMethod,
} from '@garagentor/shared';
import Link from 'next/link';
import { use, useState, type FormEvent } from 'react';
import { DocumentItems } from '@/components/document-items';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Table,
} from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useAction, useApi } from '@/lib/hooks';
import { invoiceStatus } from '@/lib/status';
import type { Invoice } from '@/lib/types';

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hasRole } = useAuth();
  const { data, loading, error, reload } = useApi<Invoice>(`/invoices/${id}`);

  const pdf = useAction(() => api.openFile(`/invoices/${id}/pdf`));
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(toIsoDate(new Date()));
  const [method, setMethod] = useState<PaymentMethod>('UEBERWEISUNG');
  const [reference, setReference] = useState('');

  const send = useAction(() => api.post(`/invoices/${id}/send`));
  const pay = useAction((body: Record<string, unknown>) =>
    api.post(`/invoices/${id}/payments`, body),
  );
  const dun = useAction(() => api.post(`/invoices/${id}/dunnings`, {}));
  const cancel = useAction(() => api.post(`/invoices/${id}/cancel`, {}));

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState />;

  const status = invoiceStatus(data.status);
  const open = data.openAmount ?? data.grossTotal - data.deductedAmount - data.paidAmount;
  const mayBook = hasRole('GESCHAEFTSFUEHRUNG', 'BUERO', 'BUCHHALTUNG');
  const actionError = send.error ?? pay.error ?? dun.error ?? cancel.error;

  async function onPayment(event: FormEvent) {
    event.preventDefault();
    const result = await pay.run({
      amount: Number(amount),
      date: new Date(paymentDate).toISOString(),
      method,
      reference: reference || undefined,
    });
    if (result) {
      setPaymentOpen(false);
      setAmount('');
      setReference('');
      reload();
    }
  }

  return (
    <>
      <PageHeader
        title={data.subject}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular">{data.invoiceNumber}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
            {data.type !== 'RECHNUNG' && <Badge tone="info">{invoiceTypeLabels[data.type]}</Badge>}
            <span>vom {formatDate(data.date)}</span>
            <span>· fällig {formatDate(data.dueDate)}</span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" loading={pdf.loading} onClick={() => void pdf.run()}>
              Als PDF
            </Button>
            {mayBook && (
              <>
                {data.status === 'ENTWURF' && (
                  <Button
                    loading={send.loading}
                    onClick={async () => {
                      if (await send.run()) reload();
                    }}
                  >
                    Rechnung stellen
                  </Button>
                )}
                {open > 0 && data.status !== 'ENTWURF' && data.status !== 'STORNIERT' && (
                  <Button variant="secondary" onClick={() => setPaymentOpen((value) => !value)}>
                    Zahlung buchen
                  </Button>
                )}
                {data.status === 'UEBERFAELLIG' && (
                  <Button
                    variant="secondary"
                    loading={dun.loading}
                    onClick={async () => {
                      if (await dun.run()) reload();
                    }}
                  >
                    Mahnung erstellen
                  </Button>
                )}
                {data.status !== 'STORNIERT' && (
                  <Button
                    variant="ghost"
                    loading={cancel.loading}
                    onClick={async () => {
                      if (await cancel.run()) reload();
                    }}
                  >
                    Stornieren
                  </Button>
                )}
              </>
            )}
          </>
        }
      />

      {actionError && (
        <div className="mb-4">
          <ErrorState message={actionError} />
        </div>
      )}

      {paymentOpen && (
        <Card title="Zahlung buchen" className="mb-6">
          <form onSubmit={onPayment} className="grid gap-4 sm:grid-cols-4" noValidate>
            <Field label="Betrag" htmlFor="amount" hint={`Offen: ${formatCurrency(open)}`} required>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={open}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </Field>
            <Field label="Datum" htmlFor="paymentDate" required>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                required
              />
            </Field>
            <Field label="Zahlungsart" htmlFor="method">
              <Select
                id="method"
                value={method}
                onChange={(event) => setMethod(event.target.value as PaymentMethod)}
              >
                {Object.entries(paymentMethodLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Verwendungszweck" htmlFor="reference">
              <Input
                id="reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-4">
              <Button type="submit" loading={pay.loading}>
                Zahlung buchen
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPaymentOpen(false)}>
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Positionen" bodyClassName="">
            <DocumentItems
              items={data.items ?? []}
              netTotal={data.netTotal}
              vatTotal={data.vatTotal}
              grossTotal={data.grossTotal}
              discountPercent={data.discountPercent}
              deductedAmount={data.deductedAmount}
              paidAmount={data.paidAmount}
            />
          </Card>

          {(data.payments ?? []).length > 0 && (
            <Card title="Zahlungen" bodyClassName="">
              <Table>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Zahlungsart</th>
                    <th>Verwendungszweck</th>
                    <th className="text-right">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.payments ?? []).map((payment) => (
                    <tr key={payment.id}>
                      <td className="tabular text-slate-700">{formatDate(payment.date)}</td>
                      <td className="text-slate-700">{paymentMethodLabels[payment.method]}</td>
                      <td className="text-slate-600">{payment.reference ?? '–'}</td>
                      <td className="tabular text-right font-medium">
                        {formatCurrency(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          {(data.dunnings ?? []).length > 0 && (
            <Card title="Mahnungen" bodyClassName="">
              <Table>
                <thead>
                  <tr>
                    <th>Stufe</th>
                    <th>Datum</th>
                    <th>Neue Frist</th>
                    <th className="text-right">Gebühr</th>
                    <th className="text-right">Zinsen</th>
                    <th className="text-right">Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.dunnings ?? []).map((dunning) => (
                    <tr key={dunning.id}>
                      <td className="font-medium text-slate-900">
                        {dunningLevelLabels[dunning.level]}
                        <span className="block text-xs font-normal text-slate-500">
                          {dunning.daysOverdue} Tage Verzug
                        </span>
                      </td>
                      <td className="tabular text-slate-700">{formatDate(dunning.date)}</td>
                      <td className="tabular text-slate-700">{formatDate(dunning.dueDate)}</td>
                      <td className="tabular text-right text-slate-700">
                        {formatCurrency(dunning.fee)}
                      </td>
                      <td className="tabular text-right text-slate-700">
                        {formatCurrency(dunning.interest)}
                      </td>
                      <td className="tabular text-right font-medium">
                        {formatCurrency(dunning.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Kunde">
            {data.customer ? (
              <>
                <Link
                  href={`/kunden/${data.customer.id}`}
                  className="text-marine-700 font-medium hover:underline"
                >
                  {customerDisplayName(data.customer)}
                </Link>
                <p className="tabular mt-0.5 text-sm text-slate-500">
                  {data.customer.customerNumber}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">–</p>
            )}
          </Card>

          <Card title="Zahlungsstand">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Zahlbetrag</dt>
                <dd className="tabular">{formatCurrency(data.grossTotal - data.deductedAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Bezahlt</dt>
                <dd className="tabular">{formatCurrency(data.paidAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <dt className="font-semibold text-slate-900">Offen</dt>
                <dd className="tabular font-semibold text-slate-900">{formatCurrency(open)}</dd>
              </div>
            </dl>
            {data.dunningLevel && (
              <p className="mt-3 text-xs text-slate-500">
                Höchste Mahnstufe: {dunningLevelLabels[data.dunningLevel]}
              </p>
            )}
          </Card>

          {data.order && (
            <Card title="Auftrag">
              <Link
                href={`/auftraege/${data.order.id}`}
                className="text-marine-700 tabular font-medium hover:underline"
              >
                {data.order.orderNumber}
              </Link>
              <p className="mt-0.5 text-sm text-slate-600">{data.order.subject}</p>
            </Card>
          )}

          {data.serviceDate && (
            <Card title="Leistungsdatum">
              <p className="tabular text-sm text-slate-700">{formatDate(data.serviceDate)}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
