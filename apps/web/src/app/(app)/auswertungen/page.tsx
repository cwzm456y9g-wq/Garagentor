'use client';

import type { EmployeeHoursRow, RevenueBucket, TopCustomerRow } from '@garagentor/shared';
import {
  defectSeverityLabels,
  formatCurrency,
  formatHours,
  inspectionResultLabels,
  orderStatusLabels,
  orderTypeLabels,
} from '@garagentor/shared';
import { useState } from 'react';
import { DatevExport } from '@/components/datev-export';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Table,
} from '@/components/ui';
import { useApi } from '@/lib/hooks';
import { inspectionResult } from '@/lib/status';
import type { InspectionStatistics, OrderStatistics } from '@/lib/types';

export default function ReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear());

  const revenue = useApi<RevenueBucket[]>('/reports/revenue', { year });
  const topCustomers = useApi<TopCustomerRow[]>('/reports/top-customers', { limit: 8 });
  const hours = useApi<EmployeeHoursRow[]>('/reports/employee-hours');
  const orders = useApi<OrderStatistics>('/reports/orders');
  const inspections = useApi<InspectionStatistics>('/reports/inspections', { year });

  const buckets = revenue.data ?? [];
  const maxRevenue = Math.max(...buckets.map((bucket) => bucket.netto), 1);
  const yearTotal = buckets.reduce((sum, bucket) => sum + bucket.netto, 0);

  return (
    <>
      <PageHeader
        title="Auswertungen"
        subtitle="Umsatz, Auftragslage, Prüfungen und Arbeitszeit"
        actions={
          <Input
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            aria-label="Geschäftsjahr"
            className="w-28"
          />
        }
      />

      <div className="space-y-6">
        <Card
          title={`Umsatz ${year}`}
          actions={
            <span className="tabular text-sm font-medium text-slate-700">
              {formatCurrency(yearTotal)} netto
            </span>
          }
        >
          {revenue.error ? (
            <ErrorState message={revenue.error} onRetry={revenue.reload} />
          ) : revenue.loading ? (
            <LoadingState />
          ) : (
            <div className="flex h-56 items-end gap-2">
              {buckets.map((bucket) => (
                <div key={bucket.periode} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="tabular text-[10px] text-slate-500">
                    {bucket.netto > 0 ? formatCurrency(bucket.netto) : ''}
                  </span>
                  <div
                    className="bg-marine-500 w-full rounded-t transition-all"
                    style={{ height: `${Math.max((bucket.netto / maxRevenue) * 100, 1)}%` }}
                    title={`${bucket.periode}: ${formatCurrency(bucket.netto)}`}
                  />
                  <span className="text-xs text-slate-500">{bucket.periode.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Umsatzstärkste Kunden" bodyClassName="">
            {(topCustomers.data ?? []).length === 0 ? (
              <EmptyState title="Noch kein Umsatz erfasst" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Kunde</th>
                    <th className="text-right">Rechnungen</th>
                    <th className="text-right">Umsatz netto</th>
                  </tr>
                </thead>
                <tbody>
                  {(topCustomers.data ?? []).map((row) => (
                    <tr key={row.customerId}>
                      <td className="text-slate-900">{row.name}</td>
                      <td className="tabular text-right text-slate-600">{row.rechnungen}</td>
                      <td className="tabular text-right font-medium">
                        {formatCurrency(row.umsatz)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Stunden je Mitarbeiter" bodyClassName="">
            {(hours.data ?? []).length === 0 ? (
              <EmptyState title="Noch keine Zeiten erfasst" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Mitarbeiter</th>
                    <th className="text-right">Gesamt</th>
                    <th className="text-right">Abrechenbar</th>
                    <th className="text-right">Fahrtzeit</th>
                  </tr>
                </thead>
                <tbody>
                  {(hours.data ?? []).map((row) => (
                    <tr key={row.employeeId}>
                      <td className="text-slate-900">{row.name}</td>
                      <td className="tabular text-right font-medium">{formatHours(row.stunden)}</td>
                      <td className="tabular text-right text-slate-600">
                        {formatHours(row.abrechenbareStunden)}
                      </td>
                      <td className="tabular text-right text-slate-600">
                        {formatHours(row.fahrtzeitStunden)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Auftragslage" bodyClassName="">
            {orders.loading ? (
              <LoadingState />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th className="text-right">Anzahl</th>
                    <th className="text-right">Netto</th>
                  </tr>
                </thead>
                <tbody>
                  {(orders.data?.nachStatus ?? []).map((row) => (
                    <tr key={row.status}>
                      <td className="text-slate-700">{orderStatusLabels[row.status]}</td>
                      <td className="tabular text-right">{row.anzahl}</td>
                      <td className="tabular text-right font-medium">
                        {formatCurrency(row.netto)}
                      </td>
                    </tr>
                  ))}
                  {(orders.data?.nachArt ?? []).map((row) => (
                    <tr key={row.art} className="bg-slate-50/50">
                      <td className="text-slate-600">Art: {orderTypeLabels[row.art]}</td>
                      <td className="tabular text-right text-slate-600">{row.anzahl}</td>
                      <td className="tabular text-right text-slate-600">
                        {formatCurrency(row.netto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title={`Prüfungen nach ASR A1.7 (${year})`}>
            {inspections.loading ? (
              <LoadingState />
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-4 text-sm">
                  <span>
                    <span className="tabular block text-2xl font-semibold text-slate-900">
                      {inspections.data?.faellig ?? 0}
                    </span>
                    <span className="text-slate-500">Prüfungen fällig</span>
                  </span>
                  <span>
                    <span className="tabular block text-2xl font-semibold text-fehler">
                      {inspections.data?.ueberfaellig ?? 0}
                    </span>
                    <span className="text-slate-500">davon überfällig</span>
                  </span>
                </div>

                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Ergebnisse
                </p>
                {(inspections.data?.ergebnisse ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">Noch keine abgeschlossene Prüfung.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {(inspections.data?.ergebnisse ?? []).map((row) => {
                      const result = inspectionResult(row.ergebnis);
                      return (
                        <li
                          key={row.ergebnis}
                          className="flex items-center justify-between text-sm"
                        >
                          <Badge tone={result.tone}>{inspectionResultLabels[row.ergebnis]}</Badge>
                          <span className="tabular font-medium">{row.anzahl}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Offene Mängel
                </p>
                {(inspections.data?.offeneMaengel ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">Keine offenen Mängel.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {(inspections.data?.offeneMaengel ?? []).map((row) => (
                      <li
                        key={row.schweregrad}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-700">
                          {defectSeverityLabels[row.schweregrad]}
                        </span>
                        <span className="tabular font-medium">{row.anzahl}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <DatevExport jahr={year} />
      </div>
    </>
  );
}
