'use client';

import type { DashboardSummary, InspectionDueRow, OpenItemRow } from '@garagentor/shared';
import { formatCurrency, formatDate } from '@garagentor/shared';
import Link from 'next/link';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
  Table,
} from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/lib/hooks';
import { inspectionDueTone } from '@/lib/status';

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const summary = useApi<DashboardSummary>('/reports/dashboard');
  const inspections = useApi<InspectionDueRow[]>('/doors/inspections-due', { withinDays: 45 });
  const showFinance = hasRole('GESCHAEFTSFUEHRUNG', 'BUERO', 'BUCHHALTUNG');
  const openItems = useApi<OpenItemRow[]>(showFinance ? '/reports/open-items' : null);

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user?.firstName ?? ''}`}
        subtitle="Überblick über Fristen, offene Posten und den Betrieb"
      />

      {summary.error ? (
        <ErrorState message={summary.error} onRetry={summary.reload} />
      ) : summary.loading || !summary.data ? (
        <LoadingState />
      ) : (
        <Kennzahlen data={summary.data} showFinance={showFinance} />
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card
          title="Anstehende Prüfungen nach ASR A1.7"
          actions={
            <Link href="/pruefungen" className="text-verweis text-sm font-medium hover:underline">
              Alle Prüfungen
            </Link>
          }
          bodyClassName=""
        >
          {inspections.error ? (
            <div className="p-5">
              <ErrorState message={inspections.error} onRetry={inspections.reload} />
            </div>
          ) : inspections.loading ? (
            <LoadingState />
          ) : (inspections.data ?? []).length === 0 ? (
            <EmptyState
              title="Keine Prüfung fällig"
              description="In den nächsten 45 Tagen steht keine wiederkehrende Prüfung an."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Anlage</th>
                  <th>Kunde</th>
                  <th>Fällig</th>
                </tr>
              </thead>
              <tbody>
                {(inspections.data ?? []).slice(0, 8).map((row) => (
                  <tr key={row.doorId}>
                    <td>
                      <Link
                        href={`/tore/${row.doorId}`}
                        className="text-verweis font-medium hover:underline"
                      >
                        {row.doorNumber}
                      </Link>
                      {row.siteLabel && (
                        <span className="block text-xs text-slate-500">{row.siteLabel}</span>
                      )}
                    </td>
                    <td className="text-slate-700">{row.customerName}</td>
                    <td>
                      <Badge tone={inspectionDueTone(row.daysUntilDue, row.overdue)}>
                        {row.overdue
                          ? row.nextDueDate
                            ? `überfällig seit ${formatDate(row.nextDueDate)}`
                            : 'noch nie geprüft'
                          : `in ${row.daysUntilDue} Tagen`}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {showFinance && (
          <Card
            title="Offene Posten"
            actions={
              <Link
                href="/rechnungen?openOnly=true"
                className="text-verweis text-sm font-medium hover:underline"
              >
                Alle Rechnungen
              </Link>
            }
            bodyClassName=""
          >
            {openItems.error ? (
              <div className="p-5">
                <ErrorState message={openItems.error} onRetry={openItems.reload} />
              </div>
            ) : openItems.loading ? (
              <LoadingState />
            ) : (openItems.data ?? []).length === 0 ? (
              <EmptyState
                title="Keine offenen Posten"
                description="Alle gestellten Rechnungen sind ausgeglichen."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Rechnung</th>
                    <th>Kunde</th>
                    <th className="text-right">Offen</th>
                    <th>Verzug</th>
                  </tr>
                </thead>
                <tbody>
                  {(openItems.data ?? []).slice(0, 8).map((row) => (
                    <tr key={row.invoiceId}>
                      <td>
                        <Link
                          href={`/rechnungen/${row.invoiceId}`}
                          className="text-verweis font-medium hover:underline"
                        >
                          {row.invoiceNumber}
                        </Link>
                      </td>
                      <td className="text-slate-700">{row.customerName}</td>
                      <td className="tabular text-right font-medium">
                        {formatCurrency(row.openAmount)}
                      </td>
                      <td>
                        {row.daysOverdue > 0 ? (
                          <Badge tone={row.daysOverdue > 30 ? 'danger' : 'warning'}>
                            {row.daysOverdue} Tage
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-500">
                            fällig {formatDate(row.dueDate)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

function Kennzahlen({ data, showFinance }: { data: DashboardSummary; showFinance: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {showFinance && (
        <>
          <StatCard
            label="Umsatz laufendes Jahr"
            value={formatCurrency(data.umsatzLaufendesJahr)}
            hint={`Laufender Monat: ${formatCurrency(data.umsatzLaufenderMonat)}`}
            tone="info"
          />
          <StatCard
            label="Offene Posten"
            value={formatCurrency(data.offenePostenBetrag)}
            hint={`${data.offenePostenAnzahl} Rechnung(en)`}
            tone={data.offenePostenBetrag > 0 ? 'warning' : 'success'}
            href="/rechnungen?openOnly=true"
          />
          <StatCard
            label="Überfällig"
            value={formatCurrency(data.ueberfaelligBetrag)}
            hint={`${data.ueberfaelligAnzahl} Rechnung(en)`}
            tone={data.ueberfaelligAnzahl > 0 ? 'danger' : 'success'}
            href="/mahnwesen"
          />
          <StatCard
            label="Offene Angebote"
            value={formatCurrency(data.offeneAngeboteBetrag)}
            hint={`${data.offeneAngeboteAnzahl} Angebot(e) versendet`}
            href="/angebote"
          />
        </>
      )}

      <StatCard
        label="Aktive Aufträge"
        value={data.aktiveAuftraegeAnzahl}
        hint="noch nicht abgeschlossen"
        tone="info"
        href="/auftraege"
      />
      <StatCard
        label="Fällige Prüfungen"
        value={data.faelligePruefungenAnzahl}
        hint={
          data.ueberfaelligePruefungenAnzahl > 0
            ? `davon ${data.ueberfaelligePruefungenAnzahl} überfällig`
            : 'keine überfällig'
        }
        tone={data.ueberfaelligePruefungenAnzahl > 0 ? 'danger' : 'success'}
        href="/tore"
      />
      <StatCard
        label="Offene Mängel"
        value={data.offeneMaengelAnzahl}
        hint="aus Prüfungen und Serviceeinsätzen"
        tone={data.offeneMaengelAnzahl > 0 ? 'warning' : 'success'}
        href="/maengel"
      />
      <StatCard
        label="Termine heute"
        value={data.termineHeuteAnzahl}
        hint="eingeplante Einsätze"
        href="/termine"
      />
      <StatCard
        label="Artikel unter Meldebestand"
        value={data.artikelUnterMindestbestand}
        hint={`Lagerwert ${formatCurrency(data.lagerwert)}`}
        tone={data.artikelUnterMindestbestand > 0 ? 'warning' : 'success'}
        href="/lager"
      />
    </div>
  );
}
