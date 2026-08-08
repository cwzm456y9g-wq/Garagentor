'use client';

import {
  appointmentTypeLabels,
  customerDisplayName,
  formatDate,
  formatHours,
  formatTime,
} from '@garagentor/shared';
import Link from 'next/link';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useApi } from '@/lib/hooks';
import type { MeinTag } from '@/lib/types';

/**
 * „Mein Tag“ – die Ansicht für draußen.
 *
 * Bewusst eine Spalte, große Ziele und keine Tabellen: bedient wird das mit
 * dem Daumen, oft mit Handschuh und selten in Ruhe. Alles, was hier steht,
 * führt mit einem Tippen dorthin, wo weitergearbeitet wird.
 */
export default function MeinTagPage() {
  const { data, loading, error, reload } = useApi<MeinTag>('/mein-tag');

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState />;

  const jetzt = new Date();
  const begruessung =
    jetzt.getHours() < 11 ? 'Guten Morgen' : jetzt.getHours() < 18 ? 'Guten Tag' : 'Guten Abend';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {begruessung}
          {data.mitarbeiter ? `, ${data.mitarbeiter.firstName}` : ''}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {formatDate(data.datum)} · {formatHours(data.stundenHeute)} erfasst
        </p>
      </div>

      {!data.mitarbeiter && (
        <p className="meldung-hinweis">
          Dieses Konto ist mit keinem Mitarbeiter verknüpft. Termine und offene Arbeiten lassen sich
          deshalb nicht zuordnen – die Verknüpfung stellt die Geschäftsführung unter Personal her.
        </p>
      )}

      {data.dringendeMaengel.length > 0 && (
        <Card title="Gefahr im Verzug" bodyClassName="">
          <ul className="divide-y divide-slate-100">
            {data.dringendeMaengel.map((mangel) => (
              <li key={mangel.id} className="px-5 py-3">
                <p className="text-sm font-medium text-fehler">{mangel.title}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {mangel.door?.doorNumber} · {mangel.door?.location}
                </p>
                {mangel.door?.customer && (
                  <p className="text-xs text-slate-500">
                    {customerDisplayName(mangel.door.customer)}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Diese Anlagen sind bis zur Instandsetzung außer Betrieb zu nehmen.
          </p>
        </Card>
      )}

      <Card title="Termine heute" bodyClassName="">
        {data.termine.length === 0 ? (
          <EmptyState title="Keine Termine" description="Für heute ist nichts eingeplant." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.termine.map((termin) => {
              const ort = termin.site
                ? [termin.site.name, termin.site.street, `${termin.site.zip} ${termin.site.city}`]
                    .filter(Boolean)
                    .join(', ')
                : termin.location;

              return (
                <li key={termin.id} className="px-5 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="tabular text-lg font-semibold text-slate-900">
                      {termin.allDay ? 'ganztägig' : formatTime(termin.start)}
                    </span>
                    <Badge tone="info">{appointmentTypeLabels[termin.type]}</Badge>
                  </div>

                  <p className="mt-1 font-medium text-slate-900">{termin.title}</p>
                  {termin.customer && (
                    <p className="text-sm text-slate-600">{customerDisplayName(termin.customer)}</p>
                  )}
                  {ort && <p className="mt-0.5 text-sm text-slate-500">{ort}</p>}
                  {termin.description && (
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
                      {termin.description}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {ort && (
                      // Führt in die Kartenanwendung des Geräts; auf dem Rechner
                      // öffnet sich die Karte im Browser.
                      <a
                        href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(ort)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                      >
                        Route
                      </a>
                    )}
                    {termin.order && (
                      <Link
                        href={`/auftraege/${termin.order.id}`}
                        className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                      >
                        Auftrag {termin.order.orderNumber}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Offene Prüfprotokolle" bodyClassName="">
        {data.offeneProtokolle.length === 0 ? (
          <EmptyState title="Nichts offen" description="Alle Protokolle sind abgeschlossen." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.offeneProtokolle.map((protokoll) => (
              <li key={protokoll.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="tabular font-medium text-slate-900">
                    {protokoll.inspectionNumber}
                  </span>
                  <span className="text-sm text-slate-500">
                    noch {protokoll.offenePunkte} von {protokoll._count.checks} Punkten
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-600">
                  {protokoll.door?.doorNumber} · {protokoll.door?.location}
                </p>
                {protokoll.door?.customer && (
                  <p className="text-xs text-slate-500">
                    {customerDisplayName(protokoll.door.customer)}
                  </p>
                )}
                <Link href={`/pruefungen/${protokoll.id}`} className="mt-3 block">
                  <Button className="w-full">Weiter prüfen</Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Offene Serviceberichte" bodyClassName="">
        {data.offeneBerichte.length === 0 ? (
          <EmptyState title="Nichts offen" description="Alle Berichte sind abgeschlossen." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.offeneBerichte.map((bericht) => (
              <li key={bericht.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="tabular font-medium text-slate-900">{bericht.reportNumber}</span>
                  <span className="text-sm text-slate-500">{formatDate(bericht.date)}</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-600">
                  {bericht.order?.subject ??
                    [bericht.door?.doorNumber, bericht.door?.location].filter(Boolean).join(' · ')}
                </p>
                <Link href={`/serviceberichte/${bericht.id}`} className="mt-3 block">
                  <Button className="w-full">Bericht abschließen</Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
