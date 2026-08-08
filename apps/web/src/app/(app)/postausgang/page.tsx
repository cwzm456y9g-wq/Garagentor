'use client';

import { formatDateTime } from '@garagentor/shared';
import { useState } from 'react';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Pagination,
  Table,
} from '@/components/ui';
import { useApi, useList } from '@/lib/hooks';
import type { MailLogEntry, MailStatusInfo } from '@/lib/types';

/**
 * Versandprotokoll. Belegt, welcher Beleg wann an wen hinausgegangen ist –
 * und welcher Versand gescheitert ist.
 */
export default function PostausgangPage() {
  const [offen, setOffen] = useState<string | null>(null);
  const liste = useList<MailLogEntry>('/mail');
  const status = useApi<MailStatusInfo>('/mail/status');

  return (
    <>
      <PageHeader
        title="Postausgang"
        subtitle="Versandprotokoll aller per Mail verschickten Belege"
        actions={
          <Input
            value={liste.search}
            onChange={(event) => liste.setSearch(event.target.value)}
            placeholder="Beleg, Empfänger oder Betreff …"
            aria-label="Versandprotokoll durchsuchen"
            className="w-64"
          />
        }
      />

      {status.data && (
        <Card className="mb-6">
          {status.data.eingerichtet ? (
            <p className="text-sm text-slate-700">
              Der Postausgang läuft über <span className="font-medium">{status.data.host}</span>
              {status.data.port ? `:${status.data.port}` : ''}, Absender{' '}
              <span className="font-medium">{status.data.absender}</span>
              {status.data.kopieAn ? `, stille Kopie an ${status.data.kopieAn}` : ''}.
            </p>
          ) : (
            <p className="text-sm text-hinweis">
              Der Postausgang ist noch nicht eingerichtet. Die Zugangsdaten des Mailservers gehören
              als MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD und MAIL_FROM in die Umgebung des
              Servers – nicht in die Anwendung und nicht in die Datensicherung.
            </p>
          )}
        </Card>
      )}

      <Card bodyClassName="">
        {liste.error ? (
          <div className="p-5">
            <ErrorState message={liste.error} onRetry={liste.reload} />
          </div>
        ) : liste.loading ? (
          <LoadingState />
        ) : liste.items.length === 0 ? (
          <EmptyState
            title="Noch nichts verschickt"
            description="Belege lassen sich auf der jeweiligen Seite über „Per Mail“ versenden."
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>Zeitpunkt</th>
                  <th>Beleg</th>
                  <th>Empfänger</th>
                  <th>Betreff</th>
                  <th>Von</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {liste.items.map((eintrag) => (
                  <tr
                    key={eintrag.id}
                    onClick={() => setOffen(offen === eintrag.id ? null : eintrag.id)}
                    className="cursor-pointer"
                  >
                    <td className="tabular whitespace-nowrap text-slate-600">
                      {formatDateTime(eintrag.createdAt)}
                    </td>
                    <td className="tabular whitespace-nowrap text-slate-900">
                      {eintrag.reference ?? '–'}
                    </td>
                    <td className="text-slate-700">{eintrag.recipient}</td>
                    <td className="text-slate-700">
                      {eintrag.subject}
                      {offen === eintrag.id && (
                        <span className="mt-2 block whitespace-pre-line rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                          {eintrag.body}
                          {eintrag.error && (
                            <span className="mt-2 block font-medium text-fehler">
                              {eintrag.error}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-slate-600">
                      {eintrag.sentBy
                        ? `${eintrag.sentBy.firstName} ${eintrag.sentBy.lastName}`
                        : '–'}
                    </td>
                    <td>
                      <Badge tone={eintrag.status === 'GESENDET' ? 'success' : 'danger'}>
                        {eintrag.status === 'GESENDET' ? 'Gesendet' : 'Fehlgeschlagen'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={liste.page}
              pageCount={liste.data?.pageCount ?? 1}
              pageSize={liste.data?.pageSize ?? 25}
              total={liste.data?.total ?? 0}
              onChange={liste.setPage}
            />
          </>
        )}
      </Card>
    </>
  );
}
