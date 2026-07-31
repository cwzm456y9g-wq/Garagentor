'use client';

import { formatCurrency, formatNumber, formatPercent } from '@garagentor/shared';
import { Badge, Table } from './ui';
import type { LineItem } from '@/lib/types';

/** Positionstabelle eines Belegs mit Summenblock. */
export function DocumentItems({
  items,
  netTotal,
  vatTotal,
  grossTotal,
  discountPercent = 0,
  deductedAmount = 0,
  paidAmount,
}: {
  items: LineItem[];
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
  discountPercent?: number;
  deductedAmount?: number;
  paidAmount?: number;
}) {
  // Netto vor Gesamtrabatt, damit der Abzug nachvollziehbar bleibt.
  const subtotal = discountPercent > 0 ? netTotal / (1 - discountPercent / 100) : netTotal;
  const payable = grossTotal - deductedAmount;

  return (
    <>
      <Table>
        <thead>
          <tr>
            <th className="w-10">Pos.</th>
            <th>Bezeichnung</th>
            <th className="text-right">Menge</th>
            <th className="text-right">Einzelpreis</th>
            <th className="text-right">Rabatt</th>
            <th className="text-right">USt</th>
            <th className="text-right">Netto</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const calculating = item.type !== 'TEXT' && item.type !== 'ZWISCHENSUMME';
            return (
              <tr key={item.id} className={item.optional ? 'bg-slate-50/70' : undefined}>
                <td className="tabular text-slate-500">{item.position}</td>
                <td>
                  <span className="font-medium text-slate-900">{item.title}</span>
                  {item.optional && (
                    <Badge tone="neutral" className="ml-2">
                      optional
                    </Badge>
                  )}
                  {item.description && (
                    <span className="mt-0.5 block whitespace-pre-line text-xs text-slate-500">
                      {item.description}
                    </span>
                  )}
                </td>
                <td className="tabular whitespace-nowrap text-right text-slate-700">
                  {calculating ? `${formatNumber(item.quantity, 2)} ${item.unit}` : '–'}
                </td>
                <td className="tabular whitespace-nowrap text-right text-slate-700">
                  {calculating ? formatCurrency(item.unitPrice) : '–'}
                </td>
                <td className="tabular text-right text-slate-600">
                  {calculating && item.discountPercent > 0
                    ? formatPercent(item.discountPercent)
                    : '–'}
                </td>
                <td className="tabular text-right text-slate-600">
                  {calculating ? `${formatNumber(item.vatRate, 0)} %` : '–'}
                </td>
                <td className="tabular whitespace-nowrap text-right font-medium">
                  {calculating ? formatCurrency(item.netAmount) : '–'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <div className="border-t border-slate-200 px-5 py-4">
        <dl className="ml-auto max-w-sm space-y-1.5 text-sm">
          {discountPercent > 0 && (
            <>
              <div className="flex justify-between gap-6">
                <dt className="text-slate-600">Zwischensumme netto</dt>
                <dd className="tabular">{formatCurrency(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-6 text-slate-600">
                <dt>Gesamtrabatt {formatPercent(discountPercent)}</dt>
                <dd className="tabular">−{formatCurrency(subtotal - netTotal)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between gap-6">
            <dt className="text-slate-600">Nettosumme</dt>
            <dd className="tabular font-medium">{formatCurrency(netTotal)}</dd>
          </div>
          <div className="flex justify-between gap-6 text-slate-600">
            <dt>Umsatzsteuer</dt>
            <dd className="tabular">{formatCurrency(vatTotal)}</dd>
          </div>
          <div className="flex justify-between gap-6 border-t border-slate-200 pt-1.5">
            <dt className="font-semibold text-slate-900">Bruttobetrag</dt>
            <dd className="tabular font-semibold text-slate-900">{formatCurrency(grossTotal)}</dd>
          </div>

          {deductedAmount > 0 && (
            <>
              <div className="flex justify-between gap-6 text-slate-600">
                <dt>abzüglich Abschlagsrechnungen</dt>
                <dd className="tabular">−{formatCurrency(deductedAmount)}</dd>
              </div>
              <div className="flex justify-between gap-6 border-t border-slate-200 pt-1.5">
                <dt className="font-semibold text-slate-900">Zahlbetrag</dt>
                <dd className="tabular font-semibold text-slate-900">{formatCurrency(payable)}</dd>
              </div>
            </>
          )}

          {paidAmount !== undefined && (
            <>
              <div className="flex justify-between gap-6 text-slate-600">
                <dt>bereits gezahlt</dt>
                <dd className="tabular">−{formatCurrency(paidAmount)}</dd>
              </div>
              <div className="flex justify-between gap-6 border-t border-slate-200 pt-1.5">
                <dt className="font-semibold text-slate-900">Offener Betrag</dt>
                <dd className="tabular text-base font-semibold text-slate-900">
                  {formatCurrency(payable - paidAmount)}
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>
    </>
  );
}
