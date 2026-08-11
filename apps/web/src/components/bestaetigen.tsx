'use client';

import { useState, type ReactNode } from 'react';
import { Button, Card, ErrorState, Field, Textarea } from '@/components/ui';

/**
 * Rückfrage vor einem Schritt, der sich nicht zurücknehmen lässt.
 *
 * Bewusst kein `window.confirm`: Das zeigt einen Satz und zwei Knöpfe, aber
 * nicht, was tatsächlich passiert. Und hier ist genau das die Frage – ob ein
 * Beleg verschwindet oder storniert wird, ob ein Kunde gelöscht oder nur
 * stillgelegt wird, hängt an seinem Zustand. Wer auf „Löschen" drückt, soll
 * vorher lesen, was der Server daraus macht.
 *
 * Ein Grund lässt sich optional erfragen. Bei einer Stornierung gehört er in
 * den Beleg – hinterher weiß sonst niemand mehr, warum.
 */
export function Bestaetigen({
  titel,
  beschreibung,
  knopf,
  grundLabel,
  grundPflicht,
  laeuft,
  fehler,
  onBestaetigen,
  onAbbrechen,
}: {
  titel: string;
  beschreibung: ReactNode;
  /** Beschriftung des bestätigenden Knopfes, etwa „Endgültig löschen". */
  knopf: string;
  /** Ist gesetzt, wird nach einem Grund gefragt. */
  grundLabel?: string;
  grundPflicht?: boolean;
  laeuft?: boolean;
  fehler?: string | null;
  onBestaetigen: (grund?: string) => void;
  onAbbrechen: () => void;
}) {
  const [grund, setGrund] = useState('');
  const fehltGrund = Boolean(grundPflicht && !grund.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={titel}
      onClick={(event) => {
        if (event.target === event.currentTarget) onAbbrechen();
      }}
    >
      <div className="w-full max-w-lg">
        <Card title={titel}>
          <div className="space-y-4">
            <div className="text-sm text-slate-700">{beschreibung}</div>

            {grundLabel && (
              <Field label={grundLabel} htmlFor="grund" required={grundPflicht}>
                <Textarea
                  id="grund"
                  rows={3}
                  value={grund}
                  onChange={(event) => setGrund(event.target.value)}
                  maxLength={500}
                />
              </Field>
            )}

            {fehler && <ErrorState message={fehler} />}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onAbbrechen}>
                Abbrechen
              </Button>
              <Button
                variant="danger"
                loading={laeuft}
                disabled={fehltGrund}
                onClick={() => onBestaetigen(grund.trim() || undefined)}
              >
                {knopf}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
