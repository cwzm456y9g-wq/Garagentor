'use client';

import { doorStatusLabels, doorTypeLabels, operationModeLabels } from '@garagentor/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { CustomerPicker } from '@/components/customer-picker';
import { Button, Card, ErrorState, Field, Input, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction } from '@/lib/hooks';
import type { Customer, Door, Site } from '@/lib/types';

interface FormValues {
  customerId: string;
  siteId: string;
  type: string;
  operationMode: string;
  status: string;
  location: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  yearBuilt: string;
  widthMm: string;
  heightMm: string;
  weightKg: string;
  driveManufacturer: string;
  driveModel: string;
  driveSerialNumber: string;
  installationDate: string;
  warrantyUntil: string;
  nextInspectionDue: string;
  notes: string;
}

/** ISO-Zeitstempel zu `JJJJ-MM-TT`, wie ein Datumsfeld es erwartet. */
function alsTag(wert: string | null | undefined): string {
  return wert ? wert.slice(0, 10) : '';
}

function toValues(door?: Door, kunde?: string): FormValues {
  return {
    customerId: door?.customerId ?? kunde ?? '',
    siteId: door?.site?.id ?? '',
    type: door?.type ?? 'SECTIONALTOR',
    // Kraftbetätigt ist die Voreinstellung, weil daran die Prüfpflicht hängt:
    // Wer sie übersieht, hätte eine Anlage ohne Frist im Bestand.
    operationMode: door?.operationMode ?? 'KRAFTBETAETIGT',
    status: door?.status ?? 'IN_BETRIEB',
    location: door?.location ?? '',
    manufacturer: door?.manufacturer ?? '',
    model: door?.model ?? '',
    serialNumber: door?.serialNumber ?? '',
    yearBuilt: door?.yearBuilt ? String(door.yearBuilt) : '',
    widthMm: door?.widthMm ? String(door.widthMm) : '',
    heightMm: door?.heightMm ? String(door.heightMm) : '',
    weightKg: door?.weightKg ? String(door.weightKg) : '',
    driveManufacturer: door?.driveManufacturer ?? '',
    driveModel: door?.driveModel ?? '',
    driveSerialNumber: door?.driveSerialNumber ?? '',
    installationDate: alsTag(door?.installationDate),
    warrantyUntil: alsTag(door?.warrantyUntil),
    nextInspectionDue: alsTag(door?.nextInspectionDue),
    notes: door?.notes ?? '',
  };
}

/** Leere Felder werden weggelassen – die API prüft streng auf bekannte Schlüssel. */
function text(wert: string): string | undefined {
  return wert.trim() || undefined;
}

function zahl(wert: string): number | undefined {
  const sauber = wert.trim();
  if (!sauber) return undefined;
  const nummer = Number(sauber);
  return Number.isFinite(nummer) ? nummer : undefined;
}

/**
 * Formular zum Anlegen und Ändern einer Toranlage.
 *
 * Die Anlage ist der Anker des ganzen Branchenteils: An ihr hängen Prüfungen
 * nach ASR A1.7, Serviceberichte, Mängel und Wartungsverträge. Ohne sie lässt
 * sich nichts davon erfassen.
 */
export function DoorForm({ door, kunde }: { door?: Door; kunde?: string }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => toValues(door, kunde));
  const [sites, setSites] = useState<Site[]>([]);

  const save = useAction(async (payload: Record<string, unknown>) =>
    door ? api.patch<Door>(`/doors/${door.id}`, payload) : api.post<Door>('/doors', payload),
  );

  // Objekte gehören zum Kunden; die Auswahl darf erst danach etwas anbieten.
  useEffect(() => {
    if (!values.customerId) {
      setSites([]);
      return;
    }

    let aktuell = true;
    api
      .get<Customer>(`/customers/${values.customerId}`)
      .then((kunde) => {
        if (aktuell) setSites(kunde.sites ?? []);
      })
      .catch(() => setSites([]));

    return () => {
      aktuell = false;
    };
  }, [values.customerId]);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => {
      // Der Kundenwechsel macht ein zuvor gewähltes Objekt gegenstandslos.
      if (key === 'customerId' && value !== current.customerId) {
        return { ...current, customerId: value as string, siteId: '' };
      }
      return { ...current, [key]: value };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const result = await save.run({
      customerId: values.customerId,
      siteId: text(values.siteId),
      type: values.type,
      operationMode: values.operationMode,
      status: values.status,
      location: values.location,
      manufacturer: text(values.manufacturer),
      model: text(values.model),
      serialNumber: text(values.serialNumber),
      yearBuilt: zahl(values.yearBuilt),
      widthMm: zahl(values.widthMm),
      heightMm: zahl(values.heightMm),
      weightKg: zahl(values.weightKg),
      driveManufacturer: text(values.driveManufacturer),
      driveModel: text(values.driveModel),
      driveSerialNumber: text(values.driveSerialNumber),
      installationDate: text(values.installationDate),
      warrantyUntil: text(values.warrantyUntil),
      nextInspectionDue: text(values.nextInspectionDue),
      notes: text(values.notes),
    });

    if (result) router.push(`/tore/${result.id}`);
  }

  const kraftbetaetigt = values.operationMode === 'KRAFTBETAETIGT';

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card title="Zuordnung">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kunde" htmlFor="customerId" required>
            <CustomerPicker
              value={values.customerId}
              onChange={(id) => set('customerId', id)}
              required
            />
          </Field>

          <Field
            label="Objekt"
            htmlFor="siteId"
            hint={
              values.customerId && sites.length === 0
                ? 'Für diesen Kunden ist kein Objekt hinterlegt. Objekte werden in der Kundenakte angelegt.'
                : undefined
            }
          >
            <Select
              id="siteId"
              value={values.siteId}
              onChange={(e) => set('siteId', e.target.value)}
              disabled={sites.length === 0}
            >
              <option value="">Ohne Objekt</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} · {site.zip} {site.city}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Einbauort"
            htmlFor="location"
            className="sm:col-span-2"
            required
            hint="Wo die Anlage steht, z. B. „Halle 2, Tor Nord“."
          >
            <Input
              id="location"
              value={values.location}
              onChange={(e) => set('location', e.target.value)}
              maxLength={200}
              required
            />
          </Field>
        </div>
      </Card>

      <Card title="Anlage">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Torart" htmlFor="type" required>
            <Select id="type" value={values.type} onChange={(e) => set('type', e.target.value)}>
              {Object.entries(doorTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Betriebsart"
            htmlFor="operationMode"
            required
            hint={
              kraftbetaetigt
                ? 'Kraftbetätigte Anlagen sind nach ASR A1.7 mindestens jährlich zu prüfen.'
                : 'Handbetätigte Anlagen unterliegen nicht der wiederkehrenden Prüfpflicht.'
            }
          >
            <Select
              id="operationMode"
              value={values.operationMode}
              onChange={(e) => set('operationMode', e.target.value)}
            >
              {Object.entries(operationModeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status" htmlFor="status">
            <Select
              id="status"
              value={values.status}
              onChange={(e) => set('status', e.target.value)}
            >
              {Object.entries(doorStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Baujahr" htmlFor="yearBuilt">
            <Input
              id="yearBuilt"
              type="number"
              min={1900}
              max={2200}
              value={values.yearBuilt}
              onChange={(e) => set('yearBuilt', e.target.value)}
            />
          </Field>

          <Field label="Hersteller" htmlFor="manufacturer">
            <Input
              id="manufacturer"
              value={values.manufacturer}
              onChange={(e) => set('manufacturer', e.target.value)}
              maxLength={100}
            />
          </Field>

          <Field label="Modell" htmlFor="model">
            <Input
              id="model"
              value={values.model}
              onChange={(e) => set('model', e.target.value)}
              maxLength={100}
            />
          </Field>

          <Field label="Seriennummer" htmlFor="serialNumber" className="sm:col-span-2">
            <Input
              id="serialNumber"
              value={values.serialNumber}
              onChange={(e) => set('serialNumber', e.target.value)}
              maxLength={100}
            />
          </Field>
        </div>
      </Card>

      <Card title="Maße">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Lichte Breite in mm" htmlFor="widthMm">
            <Input
              id="widthMm"
              type="number"
              min={0}
              max={50000}
              value={values.widthMm}
              onChange={(e) => set('widthMm', e.target.value)}
            />
          </Field>
          <Field label="Lichte Höhe in mm" htmlFor="heightMm">
            <Input
              id="heightMm"
              type="number"
              min={0}
              max={50000}
              value={values.heightMm}
              onChange={(e) => set('heightMm', e.target.value)}
            />
          </Field>
          <Field
            label="Torblattgewicht in kg"
            htmlFor="weightKg"
            hint="Für die Beurteilung des Gewichtsausgleichs bei der Prüfung."
          >
            <Input
              id="weightKg"
              type="number"
              min={0}
              step="0.01"
              value={values.weightKg}
              onChange={(e) => set('weightKg', e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card title="Antrieb">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Hersteller" htmlFor="driveManufacturer">
            <Input
              id="driveManufacturer"
              value={values.driveManufacturer}
              onChange={(e) => set('driveManufacturer', e.target.value)}
              maxLength={100}
            />
          </Field>
          <Field label="Modell" htmlFor="driveModel">
            <Input
              id="driveModel"
              value={values.driveModel}
              onChange={(e) => set('driveModel', e.target.value)}
              maxLength={100}
            />
          </Field>
          <Field label="Seriennummer" htmlFor="driveSerialNumber">
            <Input
              id="driveSerialNumber"
              value={values.driveSerialNumber}
              onChange={(e) => set('driveSerialNumber', e.target.value)}
              maxLength={100}
            />
          </Field>
        </div>
      </Card>

      <Card title="Fristen">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Einbaudatum" htmlFor="installationDate">
            <Input
              id="installationDate"
              type="date"
              value={values.installationDate}
              onChange={(e) => set('installationDate', e.target.value)}
            />
          </Field>
          <Field label="Gewährleistung bis" htmlFor="warrantyUntil">
            <Input
              id="warrantyUntil"
              type="date"
              value={values.warrantyUntil}
              onChange={(e) => set('warrantyUntil', e.target.value)}
            />
          </Field>
          <Field
            label="Nächste Prüfung"
            htmlFor="nextInspectionDue"
            hint="Ohne Angabe aus Einbaudatum und Prüfintervall ermittelt."
          >
            <Input
              id="nextInspectionDue"
              type="date"
              value={values.nextInspectionDue}
              onChange={(e) => set('nextInspectionDue', e.target.value)}
            />
          </Field>
          <Field label="Notizen" htmlFor="notes" className="sm:col-span-3">
            <textarea
              id="notes"
              className="input min-h-24"
              value={values.notes}
              onChange={(e) => set('notes', e.target.value)}
              maxLength={4000}
            />
          </Field>
        </div>
      </Card>

      {save.error && <ErrorState message={save.error} />}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={save.loading}>
          {door ? 'Änderungen speichern' : 'Toranlage anlegen'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
