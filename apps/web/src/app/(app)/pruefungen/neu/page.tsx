'use client';

import { doorTypeLabels, inspectionTypeLabels, operationModeLabels } from '@garagentor/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { CustomerPicker } from '@/components/customer-picker';
import { EmployeePicker } from '@/components/employee-picker';
import {
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
import { useAction } from '@/lib/hooks';
import type { Door, Inspection } from '@/lib/types';

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Eine Prüfung nach ASR A1.7 aufsetzen, ohne den Umweg über die Anlagenakte.
 *
 * Bisher ging das nur dort – für den geplanten Prüftag ist das der falsche
 * Weg: Wer zehn Anlagen abarbeitet, will nicht zehnmal durch den Bestand
 * blättern. Der Kunde grenzt hier die Auswahl ein, mehr nicht.
 *
 * Angelegt wird nur der Rahmen samt Prüfkatalog. Die 31 Prüfpunkte, Messwerte,
 * Fotos und die Unterschrift folgen auf der Seite des Protokolls – das
 * geschieht vor Ort und funktioniert auch ohne Netz.
 */
function Formular() {
  const router = useRouter();
  const vorgabe = useSearchParams().get('tor') ?? '';

  const [customerId, setCustomerId] = useState('');
  const [doorId, setDoorId] = useState(vorgabe);
  const [type, setType] = useState('WIEDERKEHRENDE_PRUEFUNG');
  const [datum, setDatum] = useState(heute());
  const [inspectorId, setInspectorId] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [fremd, setFremd] = useState(false);
  const [doors, setDoors] = useState<Door[]>([]);
  const [offene, setOffene] = useState<Inspection | null>(null);

  const start = useAction((body: Record<string, unknown>) =>
    api.post<{ id: string }>(`/doors/${doorId}/inspections`, body),
  );

  useEffect(() => {
    let aktuell = true;

    api
      .list<Door>('/doors', { customerId: customerId || undefined, pageSize: 200 })
      .then((seite) => {
        if (aktuell) setDoors(seite.items);
      })
      .catch(() => setDoors([]));

    return () => {
      aktuell = false;
    };
  }, [customerId]);

  // Der Server lässt je Anlage nur ein offenes Protokoll zu. Das erst beim
  // Absenden als Konflikt zu erfahren, wäre eine vermeidbare Sackgasse – zumal
  // die Antwort meist lautet: Genau dieses Protokoll wollte ich fortsetzen.
  useEffect(() => {
    if (!doorId) {
      setOffene(null);
      return;
    }

    let aktuell = true;
    api
      .list<Inspection>('/inspections', { doorId, openOnly: true, pageSize: 1 })
      .then((seite) => {
        if (aktuell) setOffene(seite.items[0] ?? null);
      })
      .catch(() => setOffene(null));

    return () => {
      aktuell = false;
    };
  }, [doorId]);

  const anlage = doors.find((door) => door.id === doorId);
  // Handbetätigte Anlagen unterliegen nicht der wiederkehrenden Prüfpflicht.
  // Verboten ist ein Protokoll trotzdem nicht – nach einem Umbau etwa –, es
  // soll nur niemand versehentlich eine Frist erzeugen, die es nicht gibt.
  const handbetaetigt = anlage?.operationMode === 'HANDBETAETIGT';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!doorId) return;

    const ergebnis = await start.run({
      type,
      date: datum,
      ...(fremd ? { inspectorName: inspectorName.trim() } : { inspectorId }),
    });

    if (ergebnis) router.push(`/pruefungen/${ergebnis.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card title="Anlage">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kunde" htmlFor="customerId" hint="Grenzt die Auswahl der Anlagen ein.">
            <CustomerPicker
              value={customerId}
              onChange={(id) => {
                setCustomerId(id);
                setDoorId('');
              }}
            />
          </Field>

          <Field
            label="Toranlage"
            htmlFor="doorId"
            required
            hint={
              customerId && doors.length === 0
                ? 'Für diesen Kunden ist keine Anlage erfasst.'
                : undefined
            }
          >
            <Select
              id="doorId"
              value={doorId}
              onChange={(event) => setDoorId(event.target.value)}
              required
            >
              <option value="">Bitte wählen …</option>
              {doors.map((door) => (
                <option key={door.id} value={door.id}>
                  {door.doorNumber} · {door.location}
                </option>
              ))}
            </Select>
          </Field>

          {anlage && (
            <p className="text-sm text-slate-600 sm:col-span-2">
              {doorTypeLabels[anlage.type]} · {operationModeLabels[anlage.operationMode]}
              {anlage.manufacturer && ` · ${anlage.manufacturer}`}
              {anlage.serialNumber && ` · Seriennummer ${anlage.serialNumber}`}
            </p>
          )}

          {offene && (
            <p className="meldung-hinweis sm:col-span-2">
              Für diese Anlage ist bereits das Protokoll{' '}
              <Link href={`/pruefungen/${offene.id}`} className="text-verweis hover:underline">
                {offene.inspectionNumber}
              </Link>{' '}
              in Bearbeitung. Ein zweites lässt sich erst anlegen, wenn dieses abgeschlossen ist.
            </p>
          )}

          {handbetaetigt && (
            <p className="meldung-hinweis sm:col-span-2">
              Diese Anlage ist handbetätigt und unterliegt nicht der wiederkehrenden Prüfpflicht
              nach ASR A1.7. Der Prüfkatalog fällt entsprechend kürzer aus – die Punkte zu Antrieb,
              Schutzeinrichtungen und Kraftmessung entfallen.
            </p>
          )}
        </div>
      </Card>

      <Card title="Prüfung">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Art der Prüfung" htmlFor="type" required>
            <Select id="type" value={type} onChange={(event) => setType(event.target.value)}>
              {Object.entries(inspectionTypeLabels).map(([wert, text]) => (
                <option key={wert} value={wert}>
                  {text}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Prüfdatum" htmlFor="datum" required>
            <Input
              id="datum"
              type="date"
              value={datum}
              onChange={(event) => setDatum(event.target.value)}
              required
            />
          </Field>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={fremd}
                onChange={(event) => setFremd(event.target.checked)}
              />
              Fremdprüfung – die prüfende Person gehört nicht zum eigenen Betrieb
            </label>
          </div>

          {fremd ? (
            <Field
              label="Prüfende Person"
              htmlFor="inspectorName"
              className="sm:col-span-2"
              required
              hint="Name und, wenn vorhanden, Firma. Die Sachkunde weist die Person selbst nach."
            >
              <Input
                id="inspectorName"
                value={inspectorName}
                onChange={(event) => setInspectorName(event.target.value)}
                maxLength={200}
                required
              />
            </Field>
          ) : (
            <Field
              label="Prüfende Person"
              htmlFor="inspectorId"
              required
              hint="Nur Mitarbeiter mit gültiger Sachkunde nach ASR A1.7."
            >
              <EmployeePicker
                id="inspectorId"
                value={inspectorId}
                onChange={setInspectorId}
                nurSachkundige
                leerText="Bitte wählen …"
                required
              />
            </Field>
          )}
        </div>
      </Card>

      {start.error && <ErrorState message={start.error} />}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          loading={start.loading}
          disabled={!doorId || Boolean(offene) || (fremd ? !inspectorName.trim() : !inspectorId)}
        >
          Prüfprotokoll anlegen
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

export default function NewInspectionPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Prüfung nach ASR A1.7 anlegen"
        subtitle="Der Prüfkatalog entsteht dabei automatisch. Prüfpunkte, Messwerte, Fotos und Unterschrift folgen im Protokoll."
      />
      <Suspense fallback={<LoadingState />}>
        <Formular />
      </Suspense>
    </div>
  );
}
