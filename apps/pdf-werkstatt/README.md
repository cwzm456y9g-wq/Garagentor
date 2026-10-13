# PDF-Werkstatt

Ein eigenständiger PDF-Editor, der komplett im Browser läuft. Dateien werden
nirgendwohin hochgeladen. Gebaut auf freien Bibliotheken: **pdf.js** (Mozilla)
zum Anzeigen, Suchen und Rendern, **pdf-lib** zum Schreiben der Datei.

```bash
npm run dev:pdf            # im Wurzelverzeichnis, dann http://localhost:5174
npm run build --workspace @garagentor/pdf-werkstatt   # statische Seite in dist/
```

`dist/` ist eine reine statische Seite und lässt sich auf jedem Webspace
ablegen, auch in einem Unterordner.

## Funktionen

| Bereich                  | Was geht                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Öffnen                   | Mehrere PDFs und Bilder (PNG, JPEG, WebP, GIF, BMP) per Dialog oder Ziehen; Bilder werden zu Seiten       |
| Ansehen                  | Zoom, Breite einpassen, Seitenminiaturen, Seitensprung, Lesezeichen                                       |
| Seiten                   | Umsortieren per Ziehen, drehen, löschen, duplizieren, leere Seite einfügen, umkehren, Mehrfachauswahl     |
| Zusammenfügen und Teilen | Beliebig viele Dateien zu einer; teilen nach Bereichen („1-3, 4-“) oder alle n Seiten; Seiten herauslösen |
| Kommentieren             | Text, Hervorheben, Rechteck, Ellipse, Linie, Pfeil, Freihand, Notiz (echter PDF-Kommentar), Abdecken      |
| Schwärzen                | Bereiche oder alle Suchtreffer; die Seite wird als Bild neu erzeugt, der Text ist danach wirklich weg     |
| Formulare                | Felder ausfüllen (Text, Ankreuzfeld, Auswahl), wahlweise reduzieren                                       |
| Unterschreiben           | Zeichnen, tippen oder Bild hochladen; gespeicherte Unterschriften; Stempel (Genehmigt, Entwurf, eigene)   |
| Gestalten                | Wasserzeichen, Seitenzahlen, Bates-Nummerierung, Kopf- und Fußzeile                                       |
| Suchen und Text          | Volltextsuche mit Markierung, gesamten Text als .txt                                                      |
| Exportieren              | Speichern, Drucken, Seiten als PNG (72–300 dpi), Kommentarliste                                           |
| Eigenschaften            | Titel, Autor, Betreff, Stichwörter, Dateiname                                                             |

Rückgängig/Wiederholen (Strg+Z/Strg+Y), Speichern (Strg+S), Öffnen (Strg+O),
Drucken (Strg+P), Entf löscht die gewählte Markierung, Esc bricht ab.
Werkzeuge per Taste: V, T, H, R, E, L, A, F, N, W, S.

## Aufbau

- `src/core` – reine PDF-Logik ohne Browser: Zusammenstellen, Zeichnen,
  Formulare, Bilder, Seitenbereiche. Getestet mit Vitest (`npm test`).
- `src/ui` – React-Oberfläche; `pdfjs.ts` kapselt Anzeigen, Suchen und Rendern.

Geöffnete Dateien werden nie verändert. Die Werkstatt merkt sich nur Seiten,
Reihenfolge, Drehung und Markierungen; erst beim Speichern entsteht daraus mit
`assemble` eine neue Datei. Wird nur ein Dokument bearbeitet, dient es als
Grundlage, damit Formulare, Lesezeichen und Eigenschaften erhalten bleiben.

## Noch nicht enthalten

- Texterkennung (OCR) für gescannte Seiten
- Vorhandenen Text im PDF direkt umschreiben (heute: abdecken und neu schreiben)
- Kennwortschutz setzen oder entfernen; verschlüsselte PDFs lassen sich nicht öffnen
- Qualifizierte elektronische Signatur (Zertifikat)
- Dateien verkleinern, PDF/A, Vergleichen zweier Fassungen
