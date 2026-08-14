'use client';

import { documentCategoryLabels, formatDateTime, formatNumber } from '@garagentor/shared';
import { useRef, useState } from 'react';
import { ListPage } from '@/components/list-page';
import { Badge, Button, Card, ErrorState, Field, PageHeader, Select } from '@/components/ui';
import { api, apiBaseUrl, tokenStore } from '@/lib/api-client';
import { useAction, useApi, useList } from '@/lib/hooks';
import type { DocumentEntry } from '@/lib/types';

export default function DocumentsPage() {
  const [category, setCategory] = useState('');
  const state = useList<DocumentEntry>('/documents', { category: category || undefined });

  // Ohne eingerichtete Ablage scheitert jeder Upload. Das soll dastehen, bevor
  // jemand eine Datei aussucht – nicht erst danach.
  const ablage = useApi<{ eingerichtet: boolean }>('/ablage');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('SONSTIGES');
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useAction((body: FormData) => api.post<DocumentEntry>('/documents', body));

  async function onUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append('file', file);
    form.append('category', uploadCategory);

    if (await upload.run(form)) {
      setUploadOpen(false);
      if (fileRef.current) fileRef.current.value = '';
      state.reload();
    }
  }

  /**
   * Der Download läuft über die API und benötigt den Access-Token. Die Datei
   * wird deshalb geladen und über eine Objekt-URL angeboten.
   */
  async function download(document_: DocumentEntry) {
    const response = await fetch(`${apiBaseUrl}/documents/${document_.id}/download`, {
      headers: { Authorization: `Bearer ${tokenStore.access}` },
    });
    if (!response.ok) return;

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = document_.originalName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Dokumente"
        subtitle="Ablage für Protokolle, Fotos und technische Unterlagen"
        actions={<Button onClick={() => setUploadOpen((open) => !open)}>Datei hochladen</Button>}
      />

      {ablage.data && !ablage.data.eingerichtet && (
        <p className="meldung-hinweis mb-6">
          Die Dateiablage ist noch nicht eingerichtet – Hochladen schlägt deshalb fehl. Die
          Zugangsdaten gehören in hPanel unter „Node.js“ (SUPABASE_URL und
          SUPABASE_SERVICE_ROLE_KEY). Unter <strong>Einstellungen → Dateiablage</strong> steht, wo
          die Werte zu finden sind, und dort läßt sich die Ablage prüfen.
        </p>
      )}

      {uploadOpen && (
        <Card title="Datei hochladen" className="mb-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Datei"
              htmlFor="file"
              hint="PDF, Bild, Office-Dokument oder Text."
              required
            >
              <input
                id="file"
                ref={fileRef}
                type="file"
                className="input file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3
                  file:py-1 file:text-sm"
              />
            </Field>
            <Field label="Kategorie" htmlFor="uploadCategory">
              <Select
                id="uploadCategory"
                value={uploadCategory}
                onChange={(event) => setUploadCategory(event.target.value)}
              >
                {Object.entries(documentCategoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end gap-2">
              <Button loading={upload.loading} onClick={() => void onUpload()}>
                Hochladen
              </Button>
              <Button variant="secondary" onClick={() => setUploadOpen(false)}>
                Abbrechen
              </Button>
            </div>
            {upload.error && (
              <div className="sm:col-span-3">
                <ErrorState message={upload.error} />
              </div>
            )}
          </div>
        </Card>
      )}

      <ListPage
        state={state}
        searchPlaceholder="Dateiname, Titel oder Beschreibung …"
        rowKey={(document_) => document_.id}
        emptyTitle="Keine Dokumente abgelegt"
        filters={
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="max-w-56"
            aria-label="Kategorie"
          >
            <option value="">Alle Kategorien</option>
            {Object.entries(documentCategoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        }
        columns={
          <>
            <th>Dateiname</th>
            <th>Kategorie</th>
            <th>Verknüpfung</th>
            <th>Hochgeladen</th>
            <th className="text-right">Größe</th>
            <th />
          </>
        }
        renderRow={(document_) => (
          <>
            <td>
              <span className="font-medium text-slate-900">
                {document_.title ?? document_.originalName}
              </span>
              {document_.title && (
                <span className="block text-xs text-slate-500">{document_.originalName}</span>
              )}
            </td>
            <td>
              <Badge tone="neutral">{documentCategoryLabels[document_.category]}</Badge>
            </td>
            <td className="text-slate-600">{document_.entityType ?? '–'}</td>
            <td className="tabular whitespace-nowrap text-slate-600">
              {formatDateTime(document_.createdAt)}
              {document_.uploadedBy && (
                <span className="block text-xs">
                  {document_.uploadedBy.firstName} {document_.uploadedBy.lastName}
                </span>
              )}
            </td>
            <td className="tabular whitespace-nowrap text-right text-slate-600">
              {formatNumber(document_.size / 1024, 0)} kB
            </td>
            <td className="text-right">
              <Button size="sm" variant="secondary" onClick={() => void download(document_)}>
                Herunterladen
              </Button>
            </td>
          </>
        )}
      />
    </>
  );
}
