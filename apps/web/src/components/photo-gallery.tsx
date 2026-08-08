'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Spinner, cx } from '@/components/ui';
import { api, requestRaw } from '@/lib/api-client';
import type { DocumentEntry } from '@/lib/types';

/**
 * Fotos an einem Datensatz – etwa an einem einzelnen Prüfpunkt.
 *
 * Die Dateien liegen in der gewohnten Dokumentenablage; der Bezug auf den
 * Prüfpunkt steckt in `entityRef`. Die Bilder lassen sich nicht als einfacher
 * Verweis einbinden, weil der Download das Zugangstoken im Kopf verlangt –
 * daher werden sie geholt und als Objekt-URL angezeigt.
 */

const ERLAUBT = 'image/jpeg,image/png,image/webp,image/heic';

function PhotoThumb({
  document: eintrag,
  onDelete,
  disabled,
}: {
  document: DocumentEntry;
  onDelete?: (id: string) => void;
  disabled?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [fehlt, setFehlt] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    let objektUrl: string | null = null;

    void (async () => {
      try {
        const antwort = await requestRaw(`/documents/${eintrag.id}/download`);
        const blob = await antwort.blob();
        if (abgebrochen) return;
        objektUrl = URL.createObjectURL(blob);
        setUrl(objektUrl);
      } catch {
        if (!abgebrochen) setFehlt(true);
      }
    })();

    return () => {
      abgebrochen = true;
      if (objektUrl) URL.revokeObjectURL(objektUrl);
    };
  }, [eintrag.id]);

  return (
    <div className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={eintrag.title ?? eintrag.originalName}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full items-center justify-center text-xs text-slate-400">
          {fehlt ? 'fehlt' : <Spinner className="h-4 w-4" />}
        </span>
      )}
      {onDelete && !disabled && (
        <button
          type="button"
          onClick={() => onDelete(eintrag.id)}
          className="absolute right-0.5 top-0.5 rounded bg-white/90 px-1 text-xs text-slate-600 opacity-0 transition-opacity hover:text-red-700 group-hover:opacity-100 focus:opacity-100"
          aria-label={`Foto ${eintrag.originalName} entfernen`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export interface PhotoGalleryProps {
  photos: DocumentEntry[];
  /** Lädt eine Datei hoch; die Seite lädt danach neu. */
  onUpload: (file: File) => Promise<unknown>;
  onDeleted: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function PhotoGallery({
  photos,
  onUpload,
  onDeleted,
  disabled,
  label = 'Foto hinzufügen',
  className,
}: PhotoGalleryProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function auswaehlen(dateien: FileList | null) {
    if (!dateien || dateien.length === 0) return;

    setLaeuft(true);
    setFehler(null);
    try {
      // Mehrere Aufnahmen nacheinander, damit eine abgelehnte Datei die
      // übrigen nicht mitreißt.
      for (const datei of Array.from(dateien)) {
        await onUpload(datei);
      }
      onDeleted();
    } catch {
      setFehler('Das Foto konnte nicht hochgeladen werden.');
    } finally {
      setLaeuft(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function entfernen(id: string) {
    setFehler(null);
    try {
      await api.delete(`/documents/${id}`);
      onDeleted();
    } catch {
      setFehler('Das Foto konnte nicht entfernt werden.');
    }
  }

  return (
    <div className={cx('flex flex-wrap items-center gap-2', className)}>
      {photos.map((foto) => (
        <PhotoThumb key={foto.id} document={foto} onDelete={entfernen} disabled={disabled} />
      ))}

      {!disabled && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ERLAUBT}
            multiple
            // capture öffnet auf dem Telefon direkt die Kamera; am Rechner
            // bleibt der Dateiauswahldialog.
            capture="environment"
            className="hidden"
            onChange={(event) => void auswaehlen(event.target.files)}
          />
          <Button
            variant="secondary"
            size="sm"
            type="button"
            loading={laeuft}
            onClick={() => inputRef.current?.click()}
          >
            {label}
          </Button>
        </>
      )}

      {fehler && <span className="text-xs text-red-700">{fehler}</span>}
    </div>
  );
}
