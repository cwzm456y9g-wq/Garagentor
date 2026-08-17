'use client';

import { formatCurrency, formatNumber, formatPercent } from '@garagentor/shared';
import { useState } from 'react';
import { EntfernenKnopf } from '@/components/entfernen';
import { ListPage } from '@/components/list-page';
import { Badge, Card, LinkButton, PageHeader, StatCard } from '@/components/ui';
import { useApi, useList } from '@/lib/hooks';
import type { Article, ArticleStock } from '@/lib/types';

export default function InventoryPage() {
  const [belowMinStock, setBelowMinStock] = useState(false);
  const state = useList<Article>('/articles', {
    belowMinStock: belowMinStock || undefined,
    active: true,
  });

  const value = useApi<{ lagerwert: number; artikel: number; positionen: number }>(
    '/articles/stock-value',
  );
  const low = useApi<ArticleStock[]>('/articles/below-min-stock');

  return (
    <>
      <PageHeader
        title="Lager"
        subtitle="Artikelstamm, Bestände und Meldebestand"
        actions={<LinkButton href="/lager/neu">Artikel anlegen</LinkButton>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Lagerwert"
          value={formatCurrency(value.data?.lagerwert ?? 0)}
          hint="zu Einkaufspreisen"
          tone="info"
        />
        <StatCard
          label="Bestandsgeführte Artikel"
          value={value.data?.artikel ?? 0}
          hint={`${formatNumber(value.data?.positionen ?? 0, 0)} Einheiten`}
        />
        <StatCard
          label="Unter Meldebestand"
          value={low.data?.length ?? 0}
          hint="Bestellvorschlag prüfen"
          tone={(low.data?.length ?? 0) > 0 ? 'warning' : 'success'}
          href="/bestellungen"
        />
      </div>

      {(low.data ?? []).length > 0 && (
        <Card title="Artikel unter Meldebestand" className="mb-6">
          <ul className="divide-y divide-slate-100 text-sm">
            {(low.data ?? []).map((row) => (
              <li key={row.articleId} className="flex items-center justify-between gap-4 py-2">
                <span className="min-w-0">
                  <span className="tabular text-slate-500">{row.articleNumber}</span>{' '}
                  <span className="text-slate-900">{row.name}</span>
                </span>
                <span className="tabular whitespace-nowrap text-slate-600">
                  Bestand {formatNumber(row.stock, 0)} / Melde {formatNumber(row.minStock, 0)} ·
                  <span className="ml-1 font-medium text-hinweis">
                    fehlt {formatNumber(row.fehlmenge, 0)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ListPage
        state={state}
        searchPlaceholder="Artikelnummer, Bezeichnung, EAN oder Hersteller …"
        rowKey={(article) => article.id}
        emptyTitle="Keine Artikel"
        filters={
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={belowMinStock}
              onChange={(event) => setBelowMinStock(event.target.checked)}
              className="rounded border-slate-300"
            />
            nur unter Meldebestand
          </label>
        }
        columns={
          <>
            <th>Nummer</th>
            <th>Bezeichnung</th>
            <th>Kategorie</th>
            <th>Lagerort</th>
            <th className="text-right">Bestand</th>
            <th className="text-right">EK</th>
            <th className="text-right">VK</th>
            <th className="text-right">Rohertrag</th>
            <th />
          </>
        }
        renderRow={(article) => (
          <>
            <td className="tabular whitespace-nowrap font-medium text-slate-900">
              {article.articleNumber}
            </td>
            <td>
              <span className="text-slate-900">{article.name}</span>
              {article.manufacturer && (
                <span className="block text-xs text-slate-500">{article.manufacturer}</span>
              )}
            </td>
            <td className="text-slate-600">{article.category ?? '–'}</td>
            <td className="text-slate-600">{article.storageLocation ?? '–'}</td>
            <td className="tabular whitespace-nowrap text-right">
              {article.stockManaged ? (
                <>
                  <span
                    className={
                      article.belowMinStock ? 'font-medium text-hinweis' : 'text-slate-900'
                    }
                  >
                    {formatNumber(article.stock, 0)} {article.unit}
                  </span>
                  {article.belowMinStock && (
                    <Badge tone="warning" className="ml-2">
                      Melde {formatNumber(article.minStock, 0)}
                    </Badge>
                  )}
                </>
              ) : (
                <span className="text-xs text-slate-500">Leistung</span>
              )}
            </td>
            <td className="tabular whitespace-nowrap text-right text-slate-600">
              {formatCurrency(article.purchasePrice)}
            </td>
            <td className="tabular whitespace-nowrap text-right font-medium">
              {formatCurrency(article.salesPrice)}
            </td>
            <td className="tabular whitespace-nowrap text-right text-slate-600">
              {formatPercent(article.margin ?? 0)}
            </td>

            <td className="whitespace-nowrap text-right">
              <LinkButton href={`/lager/${article.id}/bearbeiten`} variant="ghost" size="sm">
                Bearbeiten
              </LinkButton>
              <EntfernenKnopf
                klein
                pfad={`/articles/${article.id}`}
                titel={`Artikel ${article.articleNumber} löschen`}
                beschreibung={
                  <>
                    Der Artikel wird aus dem Stamm entfernt. Steht er auf einem Beleg oder gibt es
                    Lagerbewegungen dazu, lehnt der Server das ab – dann bleibt nur, ihn
                    stillzulegen, damit die alten Belege weiter lesbar sind.
                  </>
                }
                onEntfernt={() => state.reload()}
              />
            </td>
          </>
        )}
      />
    </>
  );
}
