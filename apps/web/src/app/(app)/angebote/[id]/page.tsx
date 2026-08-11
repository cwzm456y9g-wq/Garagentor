'use client';

import { customerDisplayName, formatCurrency, formatDate } from '@garagentor/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { DocumentItems } from '@/components/document-items';
import { MailButton } from '@/components/mail-dialog';
import { Badge, Button, Card, ErrorState, LoadingState, PageHeader, Table } from '@/components/ui';
import { Bestaetigen } from '@/components/bestaetigen';
import { api } from '@/lib/api-client';
import { useAction, useApi } from '@/lib/hooks';
import { orderStatus, quoteStatus } from '@/lib/status';
import type { Quote } from '@/lib/types';

export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, loading, error, reload } = useApi<Quote>(`/quotes/${id}`);
  const pdf = useAction(() => api.openFile(`/quotes/${id}/pdf`));
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const send = useAction(() => api.post(`/quotes/${id}/send`));
  const accept = useAction(() => api.post(`/quotes/${id}/accept`));
  const reject = useAction((body: { reason?: string }) => api.post(`/quotes/${id}/reject`, body));
  const convert = useAction(() =>
    api.post<{ id: string }>(`/quotes/${id}/convert`, { type: 'MONTAGE' }),
  );
  const entfernen = useAction(() => api.delete<{ deleted?: boolean }>(`/quotes/${id}`));
  const [loeschenOffen, setLoeschenOffen] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState />;

  const status = quoteStatus(data.status);

  // Ein Entwurf wird entfernt, alles Weitere nur storniert: Versendetes

  // verschwindet nicht spurlos, dafür ist es aus dem Haus gegangen.

  const istEntwurf = data.status === 'ENTWURF';
  const actionError = send.error ?? accept.error ?? reject.error ?? convert.error;

  async function run(action: () => Promise<unknown>) {
    const result = await action();
    if (result !== null) reload();
  }

  return (
    <>
      <PageHeader
        title={data.subject}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular">{data.quoteNumber}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
            <span>vom {formatDate(data.date)}</span>
            <span>· gültig bis {formatDate(data.validUntil)}</span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" loading={pdf.loading} onClick={() => void pdf.run()}>
              Als PDF
            </Button>
            <MailButton art="ANGEBOT" id={id} onSent={reload} />
            {data.status === 'ENTWURF' && (
              <Button loading={send.loading} onClick={() => void run(() => send.run())}>
                Versenden
              </Button>
            )}
            {(data.status === 'VERSENDET' || data.status === 'ABGELAUFEN') && (
              <>
                <Button loading={accept.loading} onClick={() => void run(() => accept.run())}>
                  Angenommen
                </Button>
                <Button variant="secondary" onClick={() => setRejectOpen((open) => !open)}>
                  Abgelehnt
                </Button>
              </>
            )}
            {data.status === 'ANGENOMMEN' && (data.orders ?? []).length === 0 && (
              <Button
                loading={convert.loading}
                onClick={async () => {
                  const order = await convert.run();
                  if (order) router.push(`/auftraege/${order.id}`);
                }}
              >
                In Auftrag überführen
              </Button>
            )}
            {(data.orders ?? []).length === 0 && data.status !== 'STORNIERT' && (
              <Button variant="ghost" onClick={() => setLoeschenOffen(true)}>
                {istEntwurf ? 'Löschen' : 'Stornieren'}
              </Button>
            )}
          </>
        }
      />

      {actionError && !loeschenOffen && (
        <div className="mb-4">
          <ErrorState message={actionError} />
        </div>
      )}

      {loeschenOffen && (
        <Bestaetigen
          titel={
            istEntwurf
              ? `Angebot ${data.quoteNumber} löschen`
              : `Angebot ${data.quoteNumber} stornieren`
          }
          knopf={istEntwurf ? 'Endgültig löschen' : 'Stornieren'}
          laeuft={entfernen.loading}
          fehler={entfernen.error}
          beschreibung={
            istEntwurf ? (
              <>
                Der Entwurf wird vollständig entfernt. Versendet wurde er nicht, ein Auftrag hängt
                nicht daran – es geht nichts verloren, was jemand außerhalb des Hauses gesehen hat.
              </>
            ) : (
              <>
                Das Angebot ist bereits aus dem Haus gegangen und wird deshalb nicht gelöscht,
                sondern als storniert gekennzeichnet. Es bleibt in der Liste sichtbar und
                nachvollziehbar.
              </>
            )
          }
          onAbbrechen={() => setLoeschenOffen(false)}
          onBestaetigen={async () => {
            const ergebnis = await entfernen.run();
            if (!ergebnis) return;
            setLoeschenOffen(false);
            if (istEntwurf) router.push('/angebote');
            else reload();
          }}
        />
      )}

      {rejectOpen && (
        <Card title="Angebot ablehnen" className="mb-6">
          <div className="space-y-3">
            <textarea
              className="input min-h-20"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Grund der Ablehnung (optional)"
              aria-label="Grund der Ablehnung"
            />
            <div className="flex gap-2">
              <Button
                variant="danger"
                loading={reject.loading}
                onClick={async () => {
                  await run(() => reject.run({ reason: reason || undefined }));
                  setRejectOpen(false);
                }}
              >
                Ablehnung speichern
              </Button>
              <Button variant="secondary" onClick={() => setRejectOpen(false)}>
                Abbrechen
              </Button>
            </div>
          </div>
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
            />
          </Card>

          {(data.introText || data.outroText) && (
            <Card title="Anschreiben">
              {data.introText && (
                <p className="whitespace-pre-line text-sm text-slate-700">{data.introText}</p>
              )}
              {data.outroText && (
                <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{data.outroText}</p>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Kunde">
            {data.customer ? (
              <>
                <Link
                  href={`/kunden/${data.customer.id}`}
                  className="text-verweis font-medium hover:underline"
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
            {data.site && (
              <p className="mt-3 text-sm text-slate-600">
                <span className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Objekt
                </span>
                {data.site.name}, {data.site.zip} {data.site.city}
              </p>
            )}
          </Card>

          <Card title="Summe">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Netto</dt>
                <dd className="tabular">{formatCurrency(data.netTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Umsatzsteuer</dt>
                <dd className="tabular">{formatCurrency(data.vatTotal)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <dt className="font-semibold text-slate-900">Brutto</dt>
                <dd className="tabular font-semibold">{formatCurrency(data.grossTotal)}</dd>
              </div>
            </dl>
          </Card>

          {data.rejectionReason && (
            <Card title="Grund der Ablehnung">
              <p className="whitespace-pre-line text-sm text-slate-700">{data.rejectionReason}</p>
            </Card>
          )}

          {(data.orders ?? []).length > 0 && (
            <Card title="Aufträge" bodyClassName="">
              <Table>
                <tbody>
                  {(data.orders ?? []).map((order) => {
                    const orderState = orderStatus(order.status);
                    return (
                      <tr key={order.id}>
                        <td>
                          <Link
                            href={`/auftraege/${order.id}`}
                            className="text-verweis tabular font-medium hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="text-right">
                          <Badge tone={orderState.tone}>{orderState.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
