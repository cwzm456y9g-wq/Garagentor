'use client';

import { formatAddress, formatPercent } from '@garagentor/shared';
import { EntfernenKnopf } from '@/components/entfernen';
import { ListPage } from '@/components/list-page';
import { LinkButton, PageHeader } from '@/components/ui';
import { useList } from '@/lib/hooks';
import type { Supplier } from '@/lib/types';

export default function SuppliersPage() {
  const state = useList<Supplier>('/suppliers');

  return (
    <>
      <PageHeader
        title="Lieferanten"
        subtitle="Bezugsquellen mit Konditionen"
        actions={<LinkButton href="/lieferanten/neu">Lieferant anlegen</LinkButton>}
      />

      <ListPage
        state={state}
        searchPlaceholder="Nummer, Name, Ansprechpartner oder Ort …"
        rowKey={(supplier) => supplier.id}
        emptyTitle="Keine Lieferanten erfasst"
        columns={
          <>
            <th>Nummer</th>
            <th>Name</th>
            <th>Anschrift</th>
            <th>Kontakt</th>
            <th className="text-right">Zahlungsziel</th>
            <th className="text-right">Skonto</th>
            <th className="text-right">Artikel</th>
            <th />
          </>
        }
        renderRow={(supplier) => (
          <>
            <td className="tabular whitespace-nowrap font-medium text-slate-900">
              {supplier.supplierNumber}
            </td>
            <td>
              <span className="text-slate-900">{supplier.name}</span>
              {supplier.customerNumber && (
                <span className="block text-xs text-slate-500">
                  Kundennr. dort: {supplier.customerNumber}
                </span>
              )}
            </td>
            <td className="text-slate-600">
              {formatAddress({ street: supplier.street, zip: supplier.zip, city: supplier.city })}
            </td>
            <td className="text-slate-600">
              {supplier.contactName && <span className="block">{supplier.contactName}</span>}
              {supplier.phone && <span className="block text-xs">{supplier.phone}</span>}
            </td>
            <td className="tabular whitespace-nowrap text-right text-slate-600">
              {supplier.paymentTermsDays} Tage
            </td>
            <td className="tabular text-right text-slate-600">
              {formatPercent(supplier.discountPercent)}
            </td>
            <td className="tabular text-right">{supplier._count?.articles ?? 0}</td>

            <td className="whitespace-nowrap text-right">
              <LinkButton href={`/lieferanten/${supplier.id}/bearbeiten`} variant="ghost" size="sm">
                Bearbeiten
              </LinkButton>
              <EntfernenKnopf
                klein
                pfad={`/suppliers/${supplier.id}`}
                titel={`Lieferant ${supplier.supplierNumber} löschen`}
                beschreibung={
                  <>
                    Der Lieferant wird entfernt. Hängen Bestellungen oder Artikel daran, lehnt der
                    Server das ab – die Zuordnung wäre sonst verloren.
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
