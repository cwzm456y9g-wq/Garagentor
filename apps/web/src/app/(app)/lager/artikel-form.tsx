'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, ErrorState, Field, Input, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction } from '@/lib/hooks';
import type { Article, Supplier } from '@/lib/types';

interface FormValues {
  name: string;
  description: string;
  category: string;
  manufacturer: string;
  manufacturerNumber: string;
  ean: string;
  unit: string;
  purchasePrice: string;
  salesPrice: string;
  vatRate: string;
  stock: string;
  minStock: string;
  storageLocation: string;
  supplierId: string;
  stockManaged: boolean;
  active: boolean;
}

function toValues(artikel?: Article): FormValues {
  return {
    name: artikel?.name ?? '',
    description: artikel?.description ?? '',
    category: artikel?.category ?? '',
    manufacturer: artikel?.manufacturer ?? '',
    manufacturerNumber: artikel?.manufacturerNumber ?? '',
    ean: artikel?.ean ?? '',
    unit: artikel?.unit ?? 'Stk',
    purchasePrice: artikel?.purchasePrice != null ? String(artikel.purchasePrice) : '',
    salesPrice: artikel?.salesPrice != null ? String(artikel.salesPrice) : '',
    vatRate: String(artikel?.vatRate ?? 19),
    stock: artikel ? String(artikel.stock) : '0',
    minStock: artikel ? String(artikel.minStock) : '0',
    storageLocation: artikel?.storageLocation ?? '',
    supplierId: artikel?.supplier?.id ?? '',
    stockManaged: artikel?.stockManaged ?? true,
    active: artikel?.active ?? true,
  };
}

function text(wert: string): string | undefined {
  return wert.trim() || undefined;
}

function zahl(wert: string): number | undefined {
  const sauber = wert.trim();
  if (!sauber) return undefined;
  const nummer = Number(sauber);
  return Number.isFinite(nummer) ? nummer : undefined;
}

/**
 * Formular für einen Lagerartikel oder eine Leistung.
 *
 * Zwei Dinge, die man leicht übersieht:
 *
 * Der Bestand lässt sich nur beim Anlegen eintragen. Danach ändert ihn
 * ausschließlich eine Buchung – Zugang, Abgang, Inventur. Wäre er frei
 * überschreibbar, stimmte die Bestandshistorie nicht mehr mit dem Bestand
 * überein, und das ist genau das, was man im Zweifel nachweisen muss.
 *
 * „Bestandsgeführt" trennt Ware von Arbeit: Eine Montagestunde hat keinen
 * Bestand und darf beim Ausbuchen von Material nicht ins Minus laufen.
 */
export function ArticleForm({ artikel }: { artikel?: Article }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => toValues(artikel));
  const [lieferanten, setLieferanten] = useState<Supplier[]>([]);

  const save = useAction(async (payload: Record<string, unknown>) =>
    artikel
      ? api.patch<Article>(`/articles/${artikel.id}`, payload)
      : api.post<Article>('/articles', payload),
  );

  // Die Lieferantenliste kennt keinen Filter auf „aktiv" – das geschieht hier.
  // Der bereits zugeordnete Lieferant bleibt aber stehen, auch wenn er
  // stillgelegt wurde: Sonst verschwände die Zuordnung beim ersten Speichern,
  // ohne dass jemand das wollte.
  useEffect(() => {
    let aktuell = true;
    const bisher = artikel?.supplier?.id;

    api
      .list<Supplier>('/suppliers', { pageSize: 200 })
      .then((seite) => {
        if (aktuell) {
          setLieferanten(seite.items.filter((eintrag) => eintrag.active || eintrag.id === bisher));
        }
      })
      .catch(() => setLieferanten([]));

    return () => {
      aktuell = false;
    };
  }, [artikel?.supplier?.id]);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const ergebnis = await save.run({
      name: values.name,
      description: text(values.description),
      category: text(values.category),
      manufacturer: text(values.manufacturer),
      manufacturerNumber: text(values.manufacturerNumber),
      ean: text(values.ean),
      unit: text(values.unit),
      purchasePrice: zahl(values.purchasePrice),
      salesPrice: zahl(values.salesPrice),
      vatRate: zahl(values.vatRate),
      // Nur beim Anlegen: Später ist der Bestand das Ergebnis der Buchungen.
      ...(artikel ? {} : { stock: zahl(values.stock) }),
      minStock: zahl(values.minStock),
      storageLocation: text(values.storageLocation),
      supplierId: text(values.supplierId),
      stockManaged: values.stockManaged,
      active: values.active,
    });

    if (ergebnis) router.push('/lager');
  }

  const rohertrag =
    zahl(values.salesPrice) !== undefined && zahl(values.purchasePrice) !== undefined
      ? zahl(values.salesPrice)! - zahl(values.purchasePrice)!
      : null;

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card title="Artikel">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bezeichnung" htmlFor="name" className="sm:col-span-2" required>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              maxLength={300}
              required
            />
          </Field>

          <Field label="Kategorie" htmlFor="category" hint="Etwa „Antriebe“ oder „Torblätter“.">
            <Input
              id="category"
              value={values.category}
              onChange={(e) => set('category', e.target.value)}
              maxLength={100}
            />
          </Field>

          <Field label="Einheit" htmlFor="unit">
            <Input
              id="unit"
              value={values.unit}
              onChange={(e) => set('unit', e.target.value)}
              maxLength={20}
              placeholder="Stk, m, h"
            />
          </Field>

          <Field label="Hersteller" htmlFor="manufacturer">
            <Input
              id="manufacturer"
              value={values.manufacturer}
              onChange={(e) => set('manufacturer', e.target.value)}
              maxLength={100}
            />
          </Field>

          <Field label="Herstellernummer" htmlFor="manufacturerNumber">
            <Input
              id="manufacturerNumber"
              value={values.manufacturerNumber}
              onChange={(e) => set('manufacturerNumber', e.target.value)}
              maxLength={100}
            />
          </Field>

          <Field label="EAN" htmlFor="ean">
            <Input
              id="ean"
              value={values.ean}
              onChange={(e) => set('ean', e.target.value)}
              maxLength={20}
            />
          </Field>

          <Field label="Lieferant" htmlFor="supplierId">
            <Select
              id="supplierId"
              value={values.supplierId}
              onChange={(e) => set('supplierId', e.target.value)}
            >
              <option value="">Ohne Lieferant</option>
              {lieferanten.map((lieferant) => (
                <option key={lieferant.id} value={lieferant.id}>
                  {lieferant.supplierNumber} · {lieferant.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Beschreibung" htmlFor="description" className="sm:col-span-2">
            <textarea
              id="description"
              className="input min-h-20"
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={4000}
            />
          </Field>
        </div>
      </Card>

      <Card title="Preise">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Einkaufspreis in €" htmlFor="purchasePrice">
            <Input
              id="purchasePrice"
              type="number"
              min={0}
              step="0.01"
              value={values.purchasePrice}
              onChange={(e) => set('purchasePrice', e.target.value)}
            />
          </Field>
          <Field
            label="Verkaufspreis in €"
            htmlFor="salesPrice"
            hint={
              rohertrag !== null
                ? `Rohertrag ${rohertrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                : undefined
            }
          >
            <Input
              id="salesPrice"
              type="number"
              min={0}
              step="0.01"
              value={values.salesPrice}
              onChange={(e) => set('salesPrice', e.target.value)}
            />
          </Field>
          <Field label="Umsatzsteuer in Prozent" htmlFor="vatRate">
            <Input
              id="vatRate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={values.vatRate}
              onChange={(e) => set('vatRate', e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card title="Lager">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-300"
                checked={values.stockManaged}
                onChange={(e) => set('stockManaged', e.target.checked)}
              />
              <span>
                Bestandsgeführt
                <span className="block text-xs text-slate-500">
                  Für Ware. Leistungen wie Montagestunden haben keinen Bestand – dort den Haken
                  entfernen.
                </span>
              </span>
            </label>
          </div>

          {values.stockManaged && (
            <>
              <Field
                label="Anfangsbestand"
                htmlFor="stock"
                hint={
                  artikel
                    ? 'Nur beim Anlegen änderbar – später zählt die Buchung.'
                    : 'Was heute im Regal liegt.'
                }
              >
                <Input
                  id="stock"
                  type="number"
                  min={0}
                  step="0.001"
                  value={values.stock}
                  onChange={(e) => set('stock', e.target.value)}
                  disabled={Boolean(artikel)}
                />
              </Field>
              <Field
                label="Meldebestand"
                htmlFor="minStock"
                hint="Darunter erscheint der Artikel in der Bestellliste."
              >
                <Input
                  id="minStock"
                  type="number"
                  min={0}
                  step="0.001"
                  value={values.minStock}
                  onChange={(e) => set('minStock', e.target.value)}
                />
              </Field>
              <Field label="Lagerort" htmlFor="storageLocation">
                <Input
                  id="storageLocation"
                  value={values.storageLocation}
                  onChange={(e) => set('storageLocation', e.target.value)}
                  maxLength={100}
                  placeholder="Regal B3"
                />
              </Field>
            </>
          )}

          <div className="sm:col-span-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={values.active}
                onChange={(e) => set('active', e.target.checked)}
              />
              Aktiv – erscheint in der Auswahl auf Belegen
            </label>
          </div>
        </div>
      </Card>

      {save.error && <ErrorState message={save.error} />}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={save.loading} disabled={!values.name.trim()}>
          {artikel ? 'Änderungen speichern' : 'Artikel anlegen'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
