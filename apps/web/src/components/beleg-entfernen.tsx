'use client';

import { useState } from 'react';
import { Bestaetigen } from '@/components/bestaetigen';
import { Button } from '@/components/ui';
import { api } from '@/lib/api-client';
import {
  angebotWirkung,
  auftragWirkung,
  rechnungWirkung,
  type Wirkung,
} from '@/lib/entfernen-wirkung';
import { useAction } from '@/lib/hooks';
import type { Invoice, Order, Quote } from '@/lib/types';

/**
 * Angebot, Auftrag oder Rechnung entfernen – aus der Liste wie aus dem Beleg.
 *
 * Ein Knopf für drei Belegarten, weil sich alle drei gleich verhalten: Ein
 * Entwurf verschwindet, alles Weitergegangene wird storniert, und was schon
 * einen Folgebeleg hat, bleibt unangetastet. Was im Einzelfall gilt, sagt die
 * Rückfrage vorher – die Beschriftung des Knopfes wechselt mit.
 *
 * Der Grund wird nur dort erfragt, wo er auch ankommt: Die Stornierung einer
 * Rechnung nimmt ihn entgegen und schreibt ihn in den Beleg. Ein Feld
 * anzubieten, dessen Inhalt anschließend verfällt, wäre eine Höflichkeit ohne
 * Wirkung.
 */
export function BelegEntfernen({
  wirkung,
  pfad,
  weg,
  mitGrund,
  klein,
  variante = 'ghost',
  onEntfernt,
}: {
  wirkung: Wirkung;
  /** Pfad ohne `/api`, etwa `/quotes/abc123`. */
  pfad: string;
  /**
   * Welcher Endpunkt zuständig ist.
   *
   * Angebot und Auftrag hören auf DELETE und entscheiden dort selbst zwischen
   * Löschen und Stornieren. Die Rechnung hat kein DELETE: Beide Fälle laufen
   * über `/cancel`, weil aus einer bezahlten Rechnung dabei auch noch eine
   * Gutschrift entstehen kann.
   */
  weg: 'loeschen' | 'storno';
  /** Stornogrund erfragen und mitschicken. */
  mitGrund?: boolean;
  klein?: boolean;
  variante?: 'ghost' | 'secondary' | 'danger';
  onEntfernt: () => void;
}) {
  const [offen, setOffen] = useState(false);

  const entfernen = useAction((grund?: string) =>
    weg === 'storno'
      ? api.post<unknown>(`${pfad}/cancel`, grund ? { reason: grund } : {})
      : api.delete<unknown>(pfad),
  );

  return (
    <>
      <Button
        variant={variante}
        size={klein ? 'sm' : 'md'}
        onClick={() => setOffen(true)}
        type="button"
      >
        {wirkung.beschriftung}
      </Button>

      {offen && (
        <Bestaetigen
          titel={wirkung.titel}
          beschreibung={wirkung.beschreibung}
          knopf={wirkung.moeglich ? wirkung.knopf : 'Schließen'}
          grundLabel={mitGrund && wirkung.moeglich ? 'Grund der Stornierung' : undefined}
          laeuft={entfernen.loading}
          fehler={entfernen.error}
          onAbbrechen={() => setOffen(false)}
          onBestaetigen={async (grund) => {
            // Bei einem aussichtslosen Fall erklärt das Fenster nur; der Knopf
            // schließt es, statt eine Absage vom Server zu holen, die niemanden
            // klüger macht.
            if (!wirkung.moeglich) {
              setOffen(false);
              return;
            }

            const ergebnis = await entfernen.run(grund);
            // `null` heißt Fehler; `undefined` ist eine gültige Antwort ohne Rumpf.
            if (ergebnis === null) return;
            setOffen(false);
            onEntfernt();
          }}
        />
      )}
    </>
  );
}

/* Fertige Knöpfe je Belegart ------------------------------------------- */

export function AngebotEntfernen({
  angebot,
  klein,
  onEntfernt,
}: {
  angebot: Quote;
  klein?: boolean;
  onEntfernt: () => void;
}) {
  return (
    <BelegEntfernen
      wirkung={angebotWirkung(
        angebot.quoteNumber,
        angebot.status,
        angebot._count?.orders ?? angebot.orders?.length ?? 0,
      )}
      pfad={`/quotes/${angebot.id}`}
      weg="loeschen"
      klein={klein}
      onEntfernt={onEntfernt}
    />
  );
}

export function AuftragEntfernen({
  auftrag,
  klein,
  onEntfernt,
}: {
  auftrag: Order;
  klein?: boolean;
  onEntfernt: () => void;
}) {
  return (
    <BelegEntfernen
      wirkung={auftragWirkung(
        auftrag.orderNumber,
        auftrag.status,
        auftrag._count?.invoices ?? auftrag.invoices?.length ?? 0,
      )}
      pfad={`/orders/${auftrag.id}`}
      weg="loeschen"
      klein={klein}
      onEntfernt={onEntfernt}
    />
  );
}

export function RechnungEntfernen({
  rechnung,
  klein,
  onEntfernt,
}: {
  rechnung: Invoice;
  klein?: boolean;
  onEntfernt: () => void;
}) {
  const wirkung = rechnungWirkung(rechnung.invoiceNumber, rechnung.status, rechnung.paidAmount);

  return (
    <BelegEntfernen
      wirkung={wirkung}
      pfad={`/invoices/${rechnung.id}`}
      // Auch der Entwurf geht über `/cancel`: Dort entscheidet der Dienst, ob
      // er entfernt oder storniert wird.
      weg="storno"
      // Den Grund nimmt nur die Stornierung entgegen; beim Entwurf verfiele er.
      mitGrund={rechnung.status !== 'ENTWURF'}
      klein={klein}
      onEntfernt={onEntfernt}
    />
  );
}
