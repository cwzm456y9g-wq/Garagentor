'use client';

import { formatCurrency, formatDate } from '@garagentor/shared';
import { useState } from 'react';
import { Button, Card, ErrorState, Field, Input, Table } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction } from '@/lib/hooks';
import type { DatevVorschau } from '@/lib/types';

/**
 * Buchungsstapel für die Kanzlei.
 *
 * Erst prüfen, dann herunterladen: was in DATEV eingelesen ist, lässt sich nur
 * mit Aufwand wieder herausnehmen. Die Vorschau zeigt deshalb Summe, Anzahl
 * und alles, was beim Aufbereiten aufgefallen ist.
 */
export function DatevExport({ jahr }: { jahr: number }) {
  const [von, setVon] = useState(`${jahr}-01-01`);
  const [bis, setBis] = useState(`${jahr}-12-31`);
  const [vorschau, setVorschau] = useState<DatevVorschau | null>(null);

  const pruefen = useAction(() =>
    api.get<DatevVorschau>('/exports/datev/vorschau', { von, bis }).then((ergebnis) => {
      setVorschau(ergebnis);
      return ergebnis;
    }),
  );
  const laden = useAction(() => api.downloadFile('/exports/datev', { von, bis }));

  const einstellungenFehlen =
    vorschau !== null &&
    (vorschau.einstellungen.beraternummer === 0 || vorschau.einstellungen.mandantennummer === 0);

  return (
    <Card title="DATEV-Export">
      <p className="text-sm text-slate-600">
        Buchungsstapel im DATEV-Format (EXTF) mit dem Rechnungsausgang des Zeitraums. Zahlungen
        bleiben außen vor – die bucht die Kanzlei aus dem Kontoauszug.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Von" htmlFor="datev-von">
          <Input
            id="datev-von"
            type="date"
            value={von}
            onChange={(event) => setVon(event.target.value)}
          />
        </Field>
        <Field label="Bis" htmlFor="datev-bis" hint="Einschließlich dieses Tages.">
          <Input
            id="datev-bis"
            type="date"
            value={bis}
            onChange={(event) => setBis(event.target.value)}
          />
        </Field>
        <div className="flex items-end gap-2">
          <Button variant="secondary" loading={pruefen.loading} onClick={() => void pruefen.run()}>
            Prüfen
          </Button>
          <Button
            loading={laden.loading}
            disabled={!vorschau || vorschau.anzahl === 0}
            onClick={() => void laden.run()}
          >
            Herunterladen
          </Button>
        </div>
      </div>

      {(pruefen.error ?? laden.error) && (
        <div className="mt-4">
          <ErrorState message={(pruefen.error ?? laden.error)!} />
        </div>
      )}

      {vorschau && (
        <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
          <div className="flex flex-wrap gap-6 text-sm">
            <span>
              <span className="text-slate-500">Buchungen </span>
              <span className="tabular font-semibold">{vorschau.anzahl}</span>
            </span>
            <span>
              <span className="text-slate-500">Summe </span>
              <span className="tabular font-semibold">{formatCurrency(vorschau.summe)}</span>
            </span>
            <span>
              <span className="text-slate-500">Kontenrahmen </span>
              <span className="font-semibold">{vorschau.einstellungen.kontenrahmen}</span>
            </span>
            <span>
              <span className="text-slate-500">Festschreibung </span>
              <span className="font-semibold">
                {vorschau.einstellungen.festschreibung ? 'ja' : 'nein'}
              </span>
            </span>
          </div>

          {einstellungenFehlen && (
            <p className="meldung-hinweis">
              Berater- und Mandantennummer stehen noch auf 0. Beide kommen vom Steuerberater und
              gehören in die Einstellungen – ohne sie ordnet DATEV den Stapel keinem Mandanten zu.
            </p>
          )}

          {vorschau.beanstandungen.length > 0 && (
            <div className="rounded-md border border-fehler-rand bg-fehler-flaeche px-4 py-3">
              <p className="text-sm font-medium text-fehler">
                {vorschau.beanstandungen.length} Beleg(e) sind nicht im Stapel enthalten:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-fehler">
                {vorschau.beanstandungen.map((hinweis, index) => (
                  <li key={`${hinweis.beleg}-${index}`}>
                    <span className="tabular font-medium">{hinweis.beleg}</span> – {hinweis.hinweis}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {vorschau.buchungen.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <th>Beleg</th>
                    <th>Datum</th>
                    <th className="text-right">Umsatz</th>
                    <th>S/H</th>
                    <th className="text-right">Konto</th>
                    <th className="text-right">Gegenkonto</th>
                    <th>Buchungstext</th>
                  </tr>
                </thead>
                <tbody>
                  {vorschau.buchungen.map((buchung, index) => (
                    <tr key={`${buchung.belegfeld1}-${buchung.steuersatz}-${index}`}>
                      <td className="tabular whitespace-nowrap">{buchung.belegfeld1}</td>
                      <td className="tabular whitespace-nowrap text-slate-600">
                        {formatDate(buchung.belegdatum)}
                      </td>
                      <td className="tabular whitespace-nowrap text-right font-medium">
                        {formatCurrency(buchung.umsatz)}
                      </td>
                      <td className="text-slate-600">{buchung.sollHaben}</td>
                      <td className="tabular text-right text-slate-700">{buchung.konto}</td>
                      <td className="tabular text-right text-slate-700">{buchung.gegenkonto}</td>
                      <td className="text-slate-600">{buchung.buchungstext}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {vorschau.anzahl > vorschau.buchungen.length && (
                <p className="px-5 py-3 text-xs text-slate-500">
                  Es werden die ersten {vorschau.buchungen.length} von {vorschau.anzahl} Buchungen
                  gezeigt; die Datei enthält alle.
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-slate-500">
            Die Datei ist in Windows-1252 kodiert, wie das Format es verlangt. Lassen Sie den ersten
            Stapel von Ihrem Steuerberater testweise einlesen, bevor Sie sich darauf verlassen.
          </p>
        </div>
      )}
    </Card>
  );
}
