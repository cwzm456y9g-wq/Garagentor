'use client';

import {
  calculateDocumentTotals,
  formatCurrency,
  formatPercent,
  lineItemTypeLabels,
  VAT_RATES,
  type LineItemType,
} from '@garagentor/shared';
import { Button, Input, Select } from './ui';

export interface EditableLineItem {
  type: LineItemType;
  articleId?: string;
  title: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPercent: string;
  vatRate: string;
  optional: boolean;
}

export function emptyLineItem(): EditableLineItem {
  return {
    type: 'LEISTUNG',
    title: '',
    description: '',
    quantity: '1',
    unit: 'Stk',
    unitPrice: '0',
    discountPercent: '0',
    vatRate: '19',
    optional: false,
  };
}

/** Wandelt die Formularwerte in die Nutzlast für die API. */
export function toApiItems(items: EditableLineItem[]) {
  return items.map((item) => ({
    type: item.type,
    articleId: item.articleId,
    title: item.title,
    description: item.description || undefined,
    quantity: Number(item.quantity) || 0,
    unit: item.unit,
    unitPrice: Number(item.unitPrice) || 0,
    discountPercent: Number(item.discountPercent) || 0,
    vatRate: Number(item.vatRate) || 0,
    optional: item.optional,
  }));
}

/**
 * Positionserfassung mit laufender Summenanzeige. Gerechnet wird mit denselben
 * Funktionen wie im Backend, sodass die Vorschau exakt dem gespeicherten Beleg
 * entspricht.
 */
export function LineItemEditor({
  items,
  onChange,
  discountPercent,
  allowOptional = false,
}: {
  items: EditableLineItem[];
  onChange: (items: EditableLineItem[]) => void;
  discountPercent: number;
  allowOptional?: boolean;
}) {
  function update(index: number, patch: Partial<EditableLineItem>) {
    onChange(items.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  }

  function remove(index: number) {
    onChange(items.filter((_, position) => position !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  const totals = calculateDocumentTotals(
    items
      .filter((item) => !item.optional)
      .map((item) => ({
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        discountPercent: Number(item.discountPercent) || 0,
        vatRate: Number(item.vatRate) || 0,
        type: item.type,
      })),
    discountPercent,
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((item, index) => {
          const calculating = item.type !== 'TEXT' && item.type !== 'ZWISCHENSUMME';
          const net = calculateDocumentTotals([
            {
              quantity: Number(item.quantity) || 0,
              unitPrice: Number(item.unitPrice) || 0,
              discountPercent: Number(item.discountPercent) || 0,
              vatRate: Number(item.vatRate) || 0,
              type: item.type,
            },
          ]).netAmount;

          return (
            <div key={index} className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="tabular w-6 text-sm font-medium text-slate-500">{index + 1}.</span>
                <Select
                  value={item.type}
                  onChange={(event) => update(index, { type: event.target.value as LineItemType })}
                  className="max-w-40"
                  aria-label={`Positionsart ${index + 1}`}
                >
                  {Object.entries(lineItemTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>

                {allowOptional && calculating && (
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={item.optional}
                      onChange={(event) => update(index, { optional: event.target.checked })}
                      className="rounded border-slate-300"
                    />
                    optional
                  </label>
                )}

                <div className="ml-auto flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Position nach oben"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label="Position nach unten"
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                    className="text-fehler hover:bg-fehler-flaeche"
                    aria-label="Position entfernen"
                  >
                    Entfernen
                  </Button>
                </div>
              </div>

              <Input
                value={item.title}
                onChange={(event) => update(index, { title: event.target.value })}
                placeholder="Bezeichnung"
                aria-label={`Bezeichnung Position ${index + 1}`}
                className="mb-2"
                required
              />
              <textarea
                value={item.description}
                onChange={(event) => update(index, { description: event.target.value })}
                placeholder="Beschreibung (optional)"
                aria-label={`Beschreibung Position ${index + 1}`}
                className="input mb-2 min-h-16"
              />

              {calculating && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                  <label className="text-xs text-slate-500">
                    Menge
                    <Input
                      type="number"
                      step="0.001"
                      value={item.quantity}
                      onChange={(event) => update(index, { quantity: event.target.value })}
                      className="mt-0.5"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Einheit
                    <Input
                      value={item.unit}
                      onChange={(event) => update(index, { unit: event.target.value })}
                      className="mt-0.5"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Einzelpreis
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(event) => update(index, { unitPrice: event.target.value })}
                      className="mt-0.5"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Rabatt %
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      value={item.discountPercent}
                      onChange={(event) => update(index, { discountPercent: event.target.value })}
                      className="mt-0.5"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    USt %
                    <Select
                      value={item.vatRate}
                      onChange={(event) => update(index, { vatRate: event.target.value })}
                      className="mt-0.5"
                    >
                      {VAT_RATES.map((rate) => (
                        <option key={rate} value={rate}>
                          {rate} %
                        </option>
                      ))}
                    </Select>
                  </label>
                  <div className="text-xs text-slate-500">
                    Netto
                    <p className="tabular mt-2 text-sm font-semibold text-slate-900">
                      {formatCurrency(net)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange([...items, emptyLineItem()])}
      >
        Position hinzufügen
      </Button>

      <div className="rounded-md border border-slate-200 bg-flaeche p-4">
        <dl className="ml-auto max-w-sm space-y-1.5 text-sm">
          <div className="flex justify-between gap-6">
            <dt className="text-slate-600">Zwischensumme netto</dt>
            <dd className="tabular font-medium">{formatCurrency(totals.subtotal)}</dd>
          </div>
          {discountPercent > 0 && (
            <div className="flex justify-between gap-6 text-slate-600">
              <dt>Gesamtrabatt {formatPercent(discountPercent)}</dt>
              <dd className="tabular">−{formatCurrency(totals.discountAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-6">
            <dt className="text-slate-600">Nettosumme</dt>
            <dd className="tabular font-medium">{formatCurrency(totals.netAmount)}</dd>
          </div>
          {totals.vatBreakdown.map((row) => (
            <div key={row.rate} className="flex justify-between gap-6 text-slate-600">
              <dt>
                zzgl. {row.rate} % USt auf {formatCurrency(row.net)}
              </dt>
              <dd className="tabular">{formatCurrency(row.vat)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-6 border-t border-slate-200 pt-1.5">
            <dt className="font-semibold text-slate-900">Gesamtbetrag brutto</dt>
            <dd className="tabular text-base font-semibold text-slate-900">
              {formatCurrency(totals.grossAmount)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
