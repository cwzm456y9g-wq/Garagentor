'use client';

import { useEffect, useState } from 'react';
import { cx } from './ui';

/**
 * Helle oder dunkle Darstellung.
 *
 * Drei Möglichkeiten: dem Gerät folgen, fest hell, fest dunkel. Die Wahl steht
 * im Browser des Geräts und nicht am Benutzerkonto – am Rechner im Büro will
 * man oft etwas anderes als auf dem Telefon in der dunklen Tiefgarage.
 */

export type Darstellung = 'system' | 'hell' | 'dunkel';

const SCHLUESSEL = 'garagentor.darstellung';

/**
 * Wird vor dem ersten Aufbau ausgeführt und setzt das Attribut, bevor etwas
 * sichtbar wird. Ohne diesen Schritt blitzt bei dunkler Einstellung für einen
 * Moment die helle Oberfläche auf.
 */
export const DARSTELLUNG_SKRIPT = `(function(){try{var w=localStorage.getItem(${JSON.stringify(
  SCHLUESSEL,
)});if(w==='hell'||w==='dunkel'){document.documentElement.setAttribute('data-theme',w);}}catch(e){}})();`;

function lies(): Darstellung {
  if (typeof window === 'undefined') return 'system';
  const wert = window.localStorage.getItem(SCHLUESSEL);
  return wert === 'hell' || wert === 'dunkel' ? wert : 'system';
}

function anwenden(wahl: Darstellung): void {
  const wurzel = document.documentElement;
  if (wahl === 'system') wurzel.removeAttribute('data-theme');
  else wurzel.setAttribute('data-theme', wahl);
}

const STUFEN: Array<{ wert: Darstellung; label: string; kurz: string }> = [
  { wert: 'hell', label: 'Helle Darstellung', kurz: 'Hell' },
  { wert: 'system', label: 'Darstellung des Geräts folgen', kurz: 'System' },
  { wert: 'dunkel', label: 'Dunkle Darstellung', kurz: 'Dunkel' },
];

export function DarstellungWahl({ className }: { className?: string }) {
  // Vor dem ersten Aufbau im Browser ist die Wahl unbekannt; bis dahin bleibt
  // nichts hervorgehoben, statt kurz das Falsche zu zeigen.
  const [wahl, setWahl] = useState<Darstellung | null>(null);

  useEffect(() => setWahl(lies()), []);

  function waehlen(neu: Darstellung) {
    setWahl(neu);
    anwenden(neu);
    try {
      if (neu === 'system') window.localStorage.removeItem(SCHLUESSEL);
      else window.localStorage.setItem(SCHLUESSEL, neu);
    } catch {
      // Ein gesperrter Speicher kostet nur die Erinnerung an die Wahl.
    }
  }

  return (
    <div
      className={cx('flex rounded-md border border-slate-300 p-0.5', className)}
      role="group"
      aria-label="Darstellung"
    >
      {STUFEN.map((stufe) => (
        <button
          key={stufe.wert}
          type="button"
          onClick={() => waehlen(stufe.wert)}
          aria-label={stufe.label}
          aria-pressed={wahl === stufe.wert}
          className={cx(
            'flex-1 rounded px-2 py-1 text-xs font-medium transition-colors',
            wahl === stufe.wert
              ? 'bg-marine-700 text-white'
              : 'text-slate-600 hover:bg-flaeche-aktiv',
          )}
        >
          {stufe.kurz}
        </button>
      ))}
    </div>
  );
}
