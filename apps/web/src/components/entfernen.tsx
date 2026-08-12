'use client';

import { useState, type ReactNode } from 'react';
import { Bestaetigen } from '@/components/bestaetigen';
import { Button } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction } from '@/lib/hooks';

/**
 * Ein Knopf, der einen Datensatz entfernt – mit Rückfrage davor.
 *
 * Elfmal dasselbe zu schreiben wäre elfmal die Gelegenheit, die Rückfrage zu
 * vergessen. Deshalb steht beides hier zusammen: Wer den Knopf setzt, bekommt
 * die Nachfrage automatisch mit.
 *
 * Was der Server daraus macht, unterscheidet sich je Datensatz – manches wird
 * gelöscht, manches nur stillgelegt oder storniert. Deshalb ist die
 * Beschreibung Sache des Aufrufers: Sie soll sagen, was tatsächlich geschieht,
 * nicht was der Knopf heißt.
 */
export function EntfernenKnopf({
  pfad,
  titel,
  beschreibung,
  knopf = 'Endgültig löschen',
  beschriftung = 'Löschen',
  variante = 'ghost',
  klein,
  onEntfernt,
}: {
  /** Pfad ohne `/api`, etwa `/doors/abc123`. */
  pfad: string;
  titel: string;
  beschreibung: ReactNode;
  /** Beschriftung im Bestätigungsfenster. */
  knopf?: string;
  /** Beschriftung des auslösenden Knopfes. */
  beschriftung?: string;
  variante?: 'ghost' | 'secondary' | 'danger';
  klein?: boolean;
  /** Wird nach dem erfolgreichen Entfernen aufgerufen – zum Neuladen oder Wegspringen. */
  onEntfernt: (ergebnis: unknown) => void;
}) {
  const [offen, setOffen] = useState(false);
  const entfernen = useAction(() => api.delete<unknown>(pfad));

  return (
    <>
      <Button
        variant={variante}
        size={klein ? 'sm' : 'md'}
        onClick={() => setOffen(true)}
        type="button"
      >
        {beschriftung}
      </Button>

      {offen && (
        <Bestaetigen
          titel={titel}
          beschreibung={beschreibung}
          knopf={knopf}
          laeuft={entfernen.loading}
          fehler={entfernen.error}
          onAbbrechen={() => setOffen(false)}
          onBestaetigen={async () => {
            const ergebnis = await entfernen.run();
            // Auf `null` prüfen, nicht auf `undefined`: Der Hook gibt bei einem
            // Fehler `null` zurück, während eine Antwort ohne Rumpf (204) ganz
            // richtig `undefined` liefert. Wer die beiden verwechselt, hält
            // jedes erfolgreiche Löschen für einen Fehlschlag – und lässt das
            // Fenster offen stehen, obwohl der Datensatz schon weg ist.
            if (ergebnis === null) return;
            setOffen(false);
            onEntfernt(ergebnis);
          }}
        />
      )}
    </>
  );
}
