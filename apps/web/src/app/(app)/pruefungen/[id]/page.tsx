'use client';

import {
  checkResultLabels,
  formatDate,
  formatNumber,
  inspectionTypeLabels,
  type CheckResult,
  type Paginated,
} from '@garagentor/shared';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { PhotoGallery } from '@/components/photo-gallery';
import { SignaturePad } from '@/components/signature-pad';
import { MailButton } from '@/components/mail-dialog';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction, useApi } from '@/lib/hooks';
import { aufOkSetzen, fehlendeMesswerte, offenePunkte } from '@/lib/pruefpunkte';
import { defectSeverity, inspectionResult } from '@/lib/status';
import type { DocumentEntry, Inspection, InspectionCheck } from '@/lib/types';

/** Eingabestand eines Prüfpunkts vor dem Speichern. */
interface CheckDraft {
  result: CheckResult;
  measuredValue: string;
  comment: string;
}

export default function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<Inspection>(`/inspections/${id}`);
  // Für die Beschriftung in der Warteschlange; vor dem Laden reicht die Kennung.
  const nummer = data?.inspectionNumber ?? id;

  // Alle Fotos des Protokolls werden einmal geladen und je Prüfpunkt verteilt –
  // 31 Einzelabfragen wären auf dem Telefon spürbar langsam.
  const fotos = useApi<Paginated<DocumentEntry>>('/documents', {
    entityType: 'INSPECTION',
    entityId: id,
    pageSize: 200,
  });

  const [drafts, setDrafts] = useState<Record<string, CheckDraft>>({});
  const [signedByName, setSignedByName] = useState('');
  const [signatureInspector, setSignatureInspector] = useState<string | null>(null);
  const [signatureCustomer, setSignatureCustomer] = useState<string | null>(null);

  // Der Eingabestand wird aus dem geladenen Protokoll vorbelegt.
  useEffect(() => {
    if (!data?.checks) return;
    setDrafts(
      Object.fromEntries(
        data.checks.map((check) => [
          check.key,
          {
            result: check.result,
            measuredValue: check.measuredValue?.toString() ?? '',
            comment: check.comment ?? '',
          },
        ]),
      ),
    );
  }, [data]);

  // Die Arbeiten am Protokoll dürfen ohne Netz in die Warteschlange: eine
  // Prüfung in der Tiefgarage bricht sonst mitten im Katalog ab.
  const save = useAction((checks: unknown[]) =>
    api.patchOffline(`/inspections/${id}/checks`, { checks }, `Prüfergebnisse ${nummer}`),
  );
  const complete = useAction((body: Record<string, unknown>) =>
    api.postOffline(`/inspections/${id}/complete`, body, `Abschluss Prüfung ${nummer}`),
  );
  const pdf = useAction(() => api.openFile(`/inspections/${id}/pdf`));
  const bescheinigung = useAction(() => api.openFile(`/inspections/${id}/bescheinigung`));

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState />;

  const checks = data.checks ?? [];
  const done = checks.filter((check) => drafts[check.key]?.result !== 'NICHT_GEPRUEFT').length;
  const defects = checks.filter((check) => drafts[check.key]?.result === 'MANGEL').length;
  const closed = Boolean(data.completedAt);
  const result = inspectionResult(data.result);

  const alleFotos = fotos.data?.items ?? [];
  const fotosZu = (key: string | null) =>
    alleFotos.filter((foto) => (foto.entityRef ?? null) === key);

  /** Lädt ein Foto hoch und hängt es an das Protokoll bzw. einen Prüfpunkt. */
  function ladeFotoHoch(datei: File, checkKey: string | null) {
    const form = new FormData();
    form.append('file', datei);
    form.append('category', 'FOTO');
    form.append('entityType', 'INSPECTION');
    form.append('entityId', id);
    if (checkKey) form.append('entityRef', checkKey);
    return api.postOffline('/documents', form, `Foto ${nummer}`);
  }

  // Prüfpunkte werden nach den Gruppen des Katalogs gegliedert.
  const groups = checks.reduce<Record<string, InspectionCheck[]>>((acc, check) => {
    (acc[check.group] ??= []).push(check);
    return acc;
  }, {});

  function setDraft(key: string, patch: Partial<CheckDraft>) {
    setDrafts((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  /**
   * Setzt die noch offenen Punkte auf „in Ordnung" – alle oder nur eine Gruppe.
   * Die Regeln dazu stehen in `pruefpunkte.ts` und werden dort geprüft.
   */
  function alleAufOk(punkte: InspectionCheck[]) {
    setDrafts((current) => aufOkSetzen(punkte, current) as Record<string, CheckDraft>);
  }

  const offene = offenePunkte(checks, drafts);
  const wartenAufMesswert = fehlendeMesswerte(checks, drafts);

  async function saveChecks() {
    const payload = checks
      .filter((check) => drafts[check.key])
      .map((check) => ({
        key: check.key,
        result: drafts[check.key].result,
        measuredValue: drafts[check.key].measuredValue
          ? Number(drafts[check.key].measuredValue)
          : undefined,
        comment: drafts[check.key].comment || undefined,
      }));

    if (await save.run(payload)) reload();
  }

  return (
    <>
      <PageHeader
        title={`Prüfprotokoll ${data.inspectionNumber}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{inspectionTypeLabels[data.type]} nach ASR A1.7</span>
            <span>· {formatDate(data.date)}</span>
            <span>· {data.inspectorName}</span>
            {closed ? (
              <Badge tone={result.tone}>{result.label}</Badge>
            ) : (
              <Badge tone="warning">in Bearbeitung</Badge>
            )}
          </span>
        }
        actions={
          <>
            {/* Was an den Kunden geht, steht vorn: die Bescheinigung mit dem
                Ergebnis. Das vollständige Protokoll bleibt erreichbar, aber
                als der Weg, den man ausdrücklich wählt. */}
            {closed && (
              <>
                <Button
                  variant="secondary"
                  loading={bescheinigung.loading}
                  onClick={() => void bescheinigung.run()}
                >
                  Bescheinigung als PDF
                </Button>
                <MailButton
                  art="PRUEFBESCHEINIGUNG"
                  id={id}
                  onSent={reload}
                  label="Bescheinigung per Mail"
                />
              </>
            )}
            <Button variant="ghost" loading={pdf.loading} onClick={() => void pdf.run()}>
              Vollständiges Protokoll
            </Button>
            {closed && (
              <MailButton
                art="PRUEFPROTOKOLL"
                id={id}
                onSent={reload}
                label="Protokoll herausgeben"
                variante="ghost"
              />
            )}
            {!closed && (
              <>
                <Button
                  variant="secondary"
                  disabled={offene.length === wartenAufMesswert.length}
                  onClick={() => alleAufOk(checks)}
                >
                  Alles in Ordnung
                </Button>
                <Button
                  variant="secondary"
                  loading={save.loading}
                  onClick={() => void saveChecks()}
                >
                  Zwischenstand speichern
                </Button>
                <Button
                  loading={complete.loading}
                  disabled={done < checks.length}
                  onClick={async () => {
                    await saveChecks();
                    const abgeschlossen = await complete.run({
                      signedByName: signedByName || undefined,
                      signatureInspector: signatureInspector ?? undefined,
                      signatureCustomer: signatureCustomer ?? undefined,
                    });
                    if (abgeschlossen) reload();
                  }}
                >
                  Prüfung abschließen
                </Button>
              </>
            )}
          </>
        }
      />

      {(save.error ?? complete.error ?? pdf.error ?? bescheinigung.error) && (
        <div className="mb-4">
          <ErrorState
            message={(save.error ?? complete.error ?? pdf.error ?? bescheinigung.error)!}
          />
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Fortschritt</p>
          <p className="tabular mt-1 text-2xl font-semibold text-slate-900">
            {done} / {checks.length}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="bg-marine-600 h-full rounded-full transition-all"
              style={{ width: `${checks.length ? (done / checks.length) * 100 : 0}%` }}
            />
          </div>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Beanstandungen
          </p>
          <p className="tabular mt-1 text-2xl font-semibold text-slate-900">{defects}</p>
          <p className="mt-1 text-xs text-slate-500">Prüfpunkte mit Mangel</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Anlage</p>
          {data.door && (
            <Link
              href={`/tore/${data.door.id}`}
              className="text-verweis mt-1 block font-medium hover:underline"
            >
              {data.door.doorNumber}
            </Link>
          )}
          <p className="mt-0.5 text-xs text-slate-500">{data.door?.location}</p>
        </Card>
      </div>

      {closed && (
        <Card title="Ergebnis" className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={result.tone}>{result.label}</Badge>
            <span className="text-sm text-slate-600">
              Nächste Prüfung: {formatDate(data.nextDueDate)}
            </span>
          </div>
          {data.summary && <p className="mt-3 text-sm text-slate-700">{data.summary}</p>}
          {(data.defects ?? []).length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              {(data.defects ?? []).map((defect) => {
                const severity = defectSeverity(defect.severity);
                return (
                  <li key={defect.id} className="flex items-start gap-2 text-sm">
                    <Badge tone={severity.tone}>{severity.label}</Badge>
                    <span className="text-slate-700">{defect.title}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {(data.signatureInspector || data.signatureCustomer) && (
            <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <SignaturePad
                label={`Prüfende Person – ${data.inspectorName}`}
                value={data.signatureInspector ?? null}
                onChange={() => undefined}
                disabled
              />
              <SignaturePad
                label={`Betreiber – ${data.signedByName ?? 'ohne Namen'}`}
                value={data.signatureCustomer ?? null}
                onChange={() => undefined}
                disabled
              />
            </div>
          )}
          {!data.signatureInspector && !data.signatureCustomer && data.signedByName && (
            <p className="mt-2 text-xs text-slate-500">Gegengezeichnet von {data.signedByName}</p>
          )}
        </Card>
      )}

      {!closed && wartenAufMesswert.length > 0 && (
        <p className="meldung-hinweis mb-6">
          {wartenAufMesswert.length === 1
            ? 'Ein Prüfpunkt bleibt offen, weil er einen Meßwert verlangt: '
            : `${wartenAufMesswert.length} Prüfpunkte bleiben offen, weil sie einen Meßwert verlangen: `}
          {wartenAufMesswert.map((check) => `Nr. ${check.position} ${check.label}`).join(', ')}.
          „Alles in Ordnung“ setzt sie nicht mit – im Protokoll stünde sonst eine Messung, die
          niemand vorgenommen hat, und genau diese Punkte entscheiden im Schadensfall. Meßwert
          eintragen, dann werden sie mitgesetzt.
        </p>
      )}

      <Card title="Fotos zur Anlage" className="mb-6">
        <PhotoGallery
          photos={fotosZu(null)}
          onUpload={(datei) => ladeFotoHoch(datei, null)}
          onDeleted={fotos.reload}
          disabled={closed}
          label="Foto aufnehmen"
        />
        <p className="mt-2 text-xs text-slate-500">
          Aufnahmen der Gesamtanlage. Fotos zu einzelnen Beanstandungen gehören an den jeweiligen
          Prüfpunkt weiter unten.
        </p>
      </Card>

      <div className="space-y-6">
        {Object.entries(groups).map(([group, items]) => (
          <Card
            key={group}
            title={group}
            bodyClassName=""
            // Je Gruppe, weil man beim Prüfen gruppenweise vorgeht: erst die
            // Sichtprüfung, dann die Schutzeinrichtungen. Wer eine Gruppe
            // durchhat, hakt sie ab, statt bis zum Ende zu warten.
            actions={
              !closed && offenePunkte(items, drafts).length > 0 ? (
                <Button size="sm" variant="ghost" onClick={() => alleAufOk(items)}>
                  Gruppe in Ordnung
                </Button>
              ) : undefined
            }
          >
            <ul className="divide-y divide-slate-100">
              {items.map((check) => {
                const draft = drafts[check.key] ?? {
                  result: check.result,
                  measuredValue: '',
                  comment: '',
                };
                const exceeded =
                  check.limitValue != null &&
                  draft.measuredValue !== '' &&
                  Number(draft.measuredValue) > check.limitValue;
                const punktFotos = fotosZu(check.key);

                return (
                  <li key={check.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          <span className="tabular mr-2 text-slate-400">{check.position}.</span>
                          {check.label}
                        </p>
                        {check.reference && (
                          <p className="mt-0.5 text-xs text-slate-500">{check.reference}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {check.limitValue != null && (
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              step="0.01"
                              value={draft.measuredValue}
                              onChange={(event) =>
                                setDraft(check.key, { measuredValue: event.target.value })
                              }
                              disabled={closed}
                              className="w-28"
                              placeholder="Messwert"
                              aria-label={`Messwert ${check.label}`}
                            />
                            <span className="whitespace-nowrap text-xs text-slate-500">
                              {check.unit} (max. {formatNumber(check.limitValue, 0)})
                            </span>
                          </div>
                        )}

                        <Select
                          value={draft.result}
                          onChange={(event) =>
                            setDraft(check.key, { result: event.target.value as CheckResult })
                          }
                          disabled={closed}
                          className="w-44"
                          aria-label={`Ergebnis ${check.label}`}
                        >
                          {Object.entries(checkResultLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {exceeded && (
                      <p className="mt-2 text-xs font-medium text-fehler">
                        Der Messwert überschreitet den Grenzwert – der Prüfpunkt wird beim Speichern
                        als Mangel gewertet.
                      </p>
                    )}

                    {(draft.result === 'MANGEL' || draft.comment) && (
                      <Input
                        value={draft.comment}
                        onChange={(event) => setDraft(check.key, { comment: event.target.value })}
                        disabled={closed}
                        placeholder="Bemerkung zum Prüfpunkt"
                        aria-label={`Bemerkung ${check.label}`}
                        className="mt-2"
                      />
                    )}

                    {/* Das Feld zum Fotografieren erscheint erst, wenn es etwas
                        zu zeigen gibt – sonst 31 Knöpfe ohne Anlass. */}
                    {(draft.result === 'MANGEL' || punktFotos.length > 0) && (
                      <PhotoGallery
                        photos={punktFotos}
                        onUpload={(datei) => ladeFotoHoch(datei, check.key)}
                        onDeleted={fotos.reload}
                        disabled={closed}
                        label="Foto zum Mangel"
                        className="mt-2"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      {!closed && (
        <Card title="Abschluss" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Gegenzeichnung durch"
              htmlFor="signedByName"
              hint="Name der Person, die das Protokoll beim Kunden bestätigt."
            >
              <Input
                id="signedByName"
                value={signedByName}
                onChange={(event) => setSignedByName(event.target.value)}
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SignaturePad
              label={`Prüfende Person – ${data.inspectorName}`}
              hint="Wird in das Protokoll übernommen und ist danach nicht mehr änderbar."
              value={signatureInspector}
              onChange={setSignatureInspector}
            />
            <SignaturePad
              label="Betreiber bzw. Beauftragter"
              hint="Bestätigt die Kenntnisnahme des Ergebnisses."
              value={signatureCustomer}
              onChange={setSignatureCustomer}
            />
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Der Abschluss setzt ein Ergebnis zu jedem Prüfpunkt voraus. Beanstandungen werden
            automatisch als Mängel mit Frist angelegt; sicherheitsrelevante Punkte führen zur
            Stilllegung der Anlage.
          </p>
        </Card>
      )}
    </>
  );
}
