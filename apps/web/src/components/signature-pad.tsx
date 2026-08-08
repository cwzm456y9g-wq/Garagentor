'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, cx } from '@/components/ui';

/**
 * Unterschriftenfeld für die Erfassung vor Ort.
 *
 * Gezeichnet wird mit Zeigerereignissen, damit Finger, Stift und Maus gleich
 * behandelt werden. Die Zeichenfläche liegt in Gerätepixeln vor, sonst wirkt
 * der Strich auf hochauflösenden Tablets ausgefranst. Ausgegeben wird ein PNG
 * als Data-URL – so lässt sich die Unterschrift ohne Umweg über die
 * Dateiablage speichern und später ins PDF setzen.
 */

/**
 * Höhe des Feldes in CSS-Pixeln. Die Breite richtet sich nach dem Platz.
 */
const HOEHE = 160;

/**
 * Obergrenze der Auflösung. Auf einem Tablet mit dreifacher Pixeldichte würde
 * ein breites Feld sonst ein PNG von mehreren hundert Kilobyte erzeugen.
 */
const MAX_PIXELVERHAELTNIS = 2;

export interface SignaturePadProps {
  label: string;
  hint?: string;
  /** Bereits erfasste Unterschrift als Data-URL. */
  value: string | null;
  onChange: (signature: string | null) => void;
  disabled?: boolean;
}

export function SignaturePad({ label, hint, value, onChange, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zeichnet = useRef(false);
  // Der zuletzt ausgegebene Stand, um ihn nach einer Größenänderung wieder
  // aufzutragen.
  const letzte = useRef<string | null>(value);
  const [leer, setLeer] = useState(!value);

  /** Legt die Zeichenfläche in Gerätepixeln an und setzt den Stift. */
  const einrichten = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const breite = canvas.clientWidth;
    if (breite === 0) return;

    const verhaeltnis = Math.min(window.devicePixelRatio || 1, MAX_PIXELVERHAELTNIS);
    const pixelBreite = Math.round(breite * verhaeltnis);
    const pixelHoehe = Math.round(HOEHE * verhaeltnis);

    // Eine Zuweisung an width oder height leert die Fläche – auch wenn sich der
    // Wert nicht ändert. Deshalb nur anfassen, wenn es wirklich nötig ist:
    // sonst löschte schon eine auftauchende Bildlaufleiste die Unterschrift.
    const unveraendert = canvas.width === pixelBreite && canvas.height === pixelHoehe;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!unveraendert) {
      canvas.width = pixelBreite;
      canvas.height = pixelHoehe;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(verhaeltnis, verhaeltnis);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#12202f';

    // Nach einer echten Größenänderung wird der bisherige Zug wieder
    // aufgetragen: ein gedrehtes Tablet darf keine Unterschrift kosten.
    const bisher = letzte.current;
    if (!unveraendert && bisher) {
      const bild = new window.Image();
      bild.onload = () => ctx.drawImage(bild, 0, 0, breite, HOEHE);
      bild.src = bisher;
    }
  }, []);

  // Beim ersten Aufbau und bei jeder Größenänderung neu einrichten.
  useEffect(() => {
    einrichten();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;

    const beobachter = new ResizeObserver(() => einrichten());
    beobachter.observe(canvas);
    return () => beobachter.disconnect();
  }, [einrichten]);

  function punkt(event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function beginnen(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    // Nur die primäre Taste bzw. Fingerspitze zeichnet.
    if (event.button !== 0) return;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Ohne preventDefault beginnt der Browser eine Textauswahl über die Seite,
    // statt den Strich zu zeichnen.
    event.preventDefault();
    // Der Zeiger wird eingefangen, damit ein Strich über den Rand hinaus nicht
    // abreißt.
    event.currentTarget.setPointerCapture(event.pointerId);
    zeichnet.current = true;

    const { x, y } = punkt(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Ein einzelner Tipper soll einen Punkt hinterlassen, keinen Nichts-Strich.
    ctx.lineTo(x + 0.1, y);
    ctx.stroke();
    setLeer(false);
  }

  function ziehen(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!zeichnet.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    event.preventDefault();
    const { x, y } = punkt(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function beenden() {
    if (!zeichnet.current) return;
    zeichnet.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatur = canvas.toDataURL('image/png');
    letzte.current = signatur;
    onChange(signatur);
  }

  function leeren() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    letzte.current = null;
    setLeer(true);
    onChange(null);
  }

  // Eine bereits gespeicherte Unterschrift wird angezeigt, nicht neu gezeichnet.
  if (disabled && value) {
    return (
      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">{label}</p>
        <div className="rounded-md border border-slate-200 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="mx-auto h-24 object-contain" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {!disabled && (
          <Button variant="ghost" size="sm" type="button" onClick={leeren} disabled={leer}>
            Löschen
          </Button>
        )}
      </div>
      <div
        className={cx(
          'relative rounded-md border bg-white',
          leer ? 'border-dashed border-slate-300' : 'border-slate-400',
        )}
      >
        {leer && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            Hier unterschreiben
          </span>
        )}
        <canvas
          ref={canvasRef}
          style={{ height: HOEHE }}
          // touch-none verhindert, dass das Wischen die Seite scrollt statt zu
          // zeichnen; select-none hält die Textauswahl aus dem Feld heraus.
          className="block w-full touch-none select-none"
          onPointerDown={beginnen}
          onPointerMove={ziehen}
          onPointerUp={beenden}
          onPointerCancel={beenden}
          aria-label={label}
        />
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
