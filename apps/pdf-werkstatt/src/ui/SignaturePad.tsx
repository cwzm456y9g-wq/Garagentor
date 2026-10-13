import { useRef, useState } from 'react';

const SIG_FONTS = [
  { label: 'Schreibschrift', css: '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive' },
  { label: 'Elegant', css: '"Lucida Handwriting", "Apple Chancery", cursive' },
  { label: 'Schlicht', css: '"Comic Sans MS", "Marker Felt", cursive' },
];

/** Unterschrift zeichnen oder tippen; liefert ein PNG mit durchsichtigem Hintergrund. */
export function SignaturePad({ onDone }: { onDone: (dataUrl: string, aspect: number) => void }) {
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [name, setName] = useState('');
  const [font, setFont] = useState(0);
  const [color, setColor] = useState('#1e3a8a');
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * e.currentTarget.width,
      y: ((e.clientY - r.top) / r.height) * e.currentTarget.height,
    };
  };

  const clear = () => {
    const c = canvas.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };

  /** Schneidet den leeren Rand ab, damit die Unterschrift sauber platziert werden kann. */
  const trimmed = (src: HTMLCanvasElement) => {
    const ctx = src.getContext('2d')!;
    const { data, width, height } = ctx.getImageData(0, 0, src.width, src.height);
    let x1 = width,
      y1 = height,
      x2 = 0,
      y2 = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3]! > 8) {
          if (x < x1) x1 = x;
          if (x > x2) x2 = x;
          if (y < y1) y1 = y;
          if (y > y2) y2 = y;
        }
      }
    }
    if (x2 < x1) return null;
    const pad = 6;
    x1 = Math.max(0, x1 - pad);
    y1 = Math.max(0, y1 - pad);
    x2 = Math.min(width - 1, x2 + pad);
    y2 = Math.min(height - 1, y2 + pad);
    const out = document.createElement('canvas');
    out.width = x2 - x1 + 1;
    out.height = y2 - y1 + 1;
    out
      .getContext('2d')!
      .drawImage(src, x1, y1, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  };

  const finish = () => {
    let src: HTMLCanvasElement | null = null;
    if (mode === 'draw') src = canvas.current;
    else {
      if (!name.trim()) return;
      src = document.createElement('canvas');
      src.width = 1200;
      src.height = 300;
      const ctx = src.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.font = `120px ${SIG_FONTS[font]!.css}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(name.trim(), 20, 150, 1160);
    }
    const out = src && trimmed(src);
    if (!out) return;
    onDone(out.toDataURL('image/png'), out.width / out.height);
    if (mode === 'draw') clear();
  };

  return (
    <div className="signature-pad">
      <div className="segmented">
        <button className={mode === 'draw' ? 'active' : ''} onClick={() => setMode('draw')}>
          Zeichnen
        </button>
        <button className={mode === 'type' ? 'active' : ''} onClick={() => setMode('type')}>
          Tippen
        </button>
      </div>
      {mode === 'draw' ? (
        <canvas
          ref={canvas}
          width={900}
          height={300}
          className="sig-canvas"
          onPointerDown={(e) => {
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            const ctx = e.currentTarget.getContext('2d')!;
            const p = pos(e);
            ctx.strokeStyle = color;
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + 0.1, p.y);
            ctx.stroke();
            setEmpty(false);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = e.currentTarget.getContext('2d')!;
            const p = pos(e);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }}
          onPointerUp={() => (drawing.current = false)}
        />
      ) : (
        <>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ihr Name" />
          <div className="sig-preview" style={{ fontFamily: SIG_FONTS[font]!.css, color }}>
            {name || 'Vorschau'}
          </div>
          <select value={font} onChange={(e) => setFont(Number(e.target.value))}>
            {SIG_FONTS.map((f, i) => (
              <option key={f.label} value={i}>
                {f.label}
              </option>
            ))}
          </select>
        </>
      )}
      <div className="row">
        <label className="inline">
          Farbe <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        {mode === 'draw' ? (
          <button onClick={clear} disabled={empty}>
            Leeren
          </button>
        ) : null}
        <button
          className="primary"
          onClick={finish}
          disabled={mode === 'draw' ? empty : !name.trim()}
        >
          Übernehmen
        </button>
      </div>
    </div>
  );
}
