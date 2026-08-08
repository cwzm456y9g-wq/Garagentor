'use client';

import { useCallback, useEffect, useState } from 'react';
import { warteschlangeUebertragen } from '@/lib/api-client';
import { beiAenderung, istOffline, wartende, type WartendeAnfrage } from '@/lib/offline';
import { Button } from './ui';

/**
 * Zustand der Verbindung und der wartenden Übertragungen.
 *
 * Ohne diese Anzeige wüsste niemand, ob die Prüfung von heute Morgen schon
 * beim Betrieb angekommen ist. Sie steht deshalb dauerhaft in der Kopfzeile,
 * sobald etwas wartet – und nicht nur als kurzer Hinweis nach dem Speichern.
 */
export function OfflineAnzeige() {
  const [offline, setOffline] = useState(false);
  const [liste, setListe] = useState<WartendeAnfrage[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  const [offen, setOffen] = useState(false);

  const aktualisieren = useCallback(() => {
    void wartende().then(setListe);
  }, []);

  const uebertragen = useCallback(async () => {
    if (istOffline()) return;
    setLaeuft(true);
    try {
      await warteschlangeUebertragen();
    } finally {
      setLaeuft(false);
      aktualisieren();
    }
  }, [aktualisieren]);

  useEffect(() => {
    setOffline(istOffline());
    aktualisieren();

    const abmelden = beiAenderung(aktualisieren);
    const wiederDa = () => {
      setOffline(false);
      // Sobald das Netz zurück ist, geht der Rückstand von selbst hinaus.
      void uebertragen();
    };
    const weg = () => setOffline(true);

    window.addEventListener('online', wiederDa);
    window.addEventListener('offline', weg);
    return () => {
      abmelden();
      window.removeEventListener('online', wiederDa);
      window.removeEventListener('offline', weg);
    };
  }, [aktualisieren, uebertragen]);

  if (!offline && liste.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOffen((auf) => !auf)}
        aria-expanded={offen}
        className={
          offline
            ? 'meldung-hinweis whitespace-nowrap px-3 py-1.5 text-xs font-medium'
            : 'meldung-erfolg whitespace-nowrap px-3 py-1.5 text-xs font-medium'
        }
      >
        {offline ? 'Ohne Netz' : 'Bereit'}
        {liste.length > 0 && ` · ${liste.length} wartet`}
      </button>

      {offen && (
        <div className="bg-flaeche absolute right-0 z-30 mt-1 w-80 rounded-md border border-slate-200 p-4 shadow-lg">
          <p className="text-sm font-medium text-slate-900">
            {offline ? 'Keine Verbindung' : 'Verbindung besteht'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {liste.length === 0
              ? 'Es wartet nichts auf Übertragung.'
              : 'Diese Eingaben liegen im Browser und gehen hinaus, sobald es geht. Das Gerät bitte nicht zurücksetzen, bevor die Liste leer ist.'}
          </p>

          {liste.length > 0 && (
            <ul className="mt-3 space-y-2">
              {liste.map((eintrag) => (
                <li key={eintrag.id} className="text-sm text-slate-700">
                  {eintrag.bezeichnung}
                  {eintrag.fehler && (
                    <span className="text-fehler mt-0.5 block text-xs">{eintrag.fehler}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {liste.length > 0 && !offline && (
            <Button
              size="sm"
              className="mt-3 w-full"
              loading={laeuft}
              onClick={() => void uebertragen()}
            >
              Jetzt übertragen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
