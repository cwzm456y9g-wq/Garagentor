'use client';

import {
  customerDisplayName,
  dunningLevelLabels,
  formatCurrency,
  formatDate,
  formatNumber,
} from '@garagentor/shared';
import Link from 'next/link';
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Table,
} from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction, useApi } from '@/lib/hooks';
import type { Dunning, DunningPreview } from '@/lib/types';

export default function DunningPage() {
  const preview = useApi<DunningPreview[]>('/dunnings/preview');
  const list = useApi<{ items: Dunning[] }>('/dunnings', { pageSize: 50 });
  const [ran, setRan] = useState<number | null>(null);

  const run = useAction(() => api.post<{ created: number }>('/dunnings/run', {}));
  const send = useAction((id: string) => api.post(`/dunnings/${id}/send`, {}));

  const candidates = preview.data ?? [];

  return (
    <>
      <PageHeader
        title="Mahnwesen"
        subtitle="Vorschau und Ausführung des Mahnlaufs nach den hinterlegten Stufen"
        actions={
          <Button
            loading={run.loading}
            disabled={candidates.length === 0}
            onClick={async () => {
              const result = await run.run();
              if (result) {
                setRan(result.created);
                preview.reload();
                list.reload();
              }
            }}
          >
            Mahnlauf ausführen
          </Button>
        }
      />

      {(run.error ?? send.error) && (
        <div className="mb-4">
          <ErrorState message={(run.error ?? send.error)!} />
        </div>
      )}

      {ran !== null && (
        <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Der Mahnlauf hat {ran} Mahnung(en) als Entwurf angelegt. Vor dem Versand können sie unten
          geprüft werden.
        </div>
      )}

      <div className="space-y-6">
        <Card
          title="Vorschau des Mahnlaufs"
          actions={
            <span className="text-sm text-slate-500">{candidates.length} Rechnung(en) fällig</span>
          }
          bodyClassName=""
        >
          {preview.error ? (
            <div className="p-5">
              <ErrorState message={preview.error} onRetry={preview.reload} />
            </div>
          ) : preview.loading ? (
            <LoadingState />
          ) : candidates.length === 0 ? (
            <EmptyState
              title="Keine Mahnung fällig"
              description="Alle offenen Rechnungen liegen innerhalb der Zahlungsfrist oder wurden bereits gemahnt."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Rechnung</th>
                  <th>Kunde</th>
                  <th>Nächste Stufe</th>
                  <th className="text-right">Verzug</th>
                  <th className="text-right">Offen</th>
                  <th className="text-right">Gebühr</th>
                  <th className="text-right">Zinsen</th>
                  <th className="text-right">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((row) => (
                  <tr key={row.invoiceId}>
                    <td className="tabular">
                      <Link
                        href={`/rechnungen/${row.invoiceId}`}
                        className="text-marine-700 font-medium hover:underline"
                      >
                        {row.invoiceNumber}
                      </Link>
                    </td>
                    <td className="text-slate-700">
                      {row.customer ? customerDisplayName(row.customer) : '–'}
                    </td>
                    <td>
                      <Badge tone="warning">{dunningLevelLabels[row.level]}</Badge>
                    </td>
                    <td className="tabular text-right text-slate-600">{row.daysOverdue} Tage</td>
                    <td className="tabular text-right text-slate-700">
                      {formatCurrency(row.openAmount)}
                    </td>
                    <td className="tabular text-right text-slate-600">{formatCurrency(row.fee)}</td>
                    <td className="tabular text-right text-slate-600">
                      {formatCurrency(row.interest)}
                      {row.interestPercent > 0 && (
                        <span className="block text-xs text-slate-400">
                          {formatNumber(row.interestPercent, 2)} %
                        </span>
                      )}
                    </td>
                    <td className="tabular text-right font-semibold">
                      {formatCurrency(row.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title="Erstellte Mahnungen" bodyClassName="">
          {list.loading ? (
            <LoadingState />
          ) : (list.data?.items ?? []).length === 0 ? (
            <EmptyState title="Noch keine Mahnungen erstellt" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Rechnung</th>
                  <th>Kunde</th>
                  <th>Stufe</th>
                  <th>Datum</th>
                  <th>Neue Frist</th>
                  <th className="text-right">Gesamt</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(list.data?.items ?? []).map((dunning) => (
                  <tr key={dunning.id}>
                    <td className="tabular">
                      {dunning.invoice && (
                        <Link
                          href={`/rechnungen/${dunning.invoice.id}`}
                          className="text-marine-700 font-medium hover:underline"
                        >
                          {dunning.invoice.invoiceNumber}
                        </Link>
                      )}
                    </td>
                    <td className="text-slate-700">
                      {dunning.invoice?.customer
                        ? customerDisplayName(dunning.invoice.customer)
                        : '–'}
                    </td>
                    <td className="whitespace-nowrap text-slate-700">
                      {dunningLevelLabels[dunning.level]}
                    </td>
                    <td className="tabular whitespace-nowrap text-slate-600">
                      {formatDate(dunning.date)}
                    </td>
                    <td className="tabular whitespace-nowrap text-slate-600">
                      {formatDate(dunning.dueDate)}
                    </td>
                    <td className="tabular whitespace-nowrap text-right font-medium">
                      {formatCurrency(dunning.totalAmount)}
                    </td>
                    <td>
                      <Badge
                        tone={
                          dunning.status === 'ENTWURF'
                            ? 'neutral'
                            : dunning.status === 'ERLEDIGT'
                              ? 'success'
                              : dunning.status === 'ABGEBROCHEN'
                                ? 'danger'
                                : 'info'
                        }
                      >
                        {dunning.status === 'ENTWURF'
                          ? 'Entwurf'
                          : dunning.status === 'VERSENDET'
                            ? 'Versendet'
                            : dunning.status === 'ERLEDIGT'
                              ? 'Erledigt'
                              : 'Abgebrochen'}
                      </Badge>
                    </td>
                    <td className="text-right">
                      {dunning.status === 'ENTWURF' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            if (await send.run(dunning.id)) list.reload();
                          }}
                        >
                          Als versendet buchen
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
