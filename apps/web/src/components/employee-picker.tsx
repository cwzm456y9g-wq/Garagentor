'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { Employee } from '@/lib/types';
import { Select } from './ui';

/**
 * Lädt die Mitarbeiter, die für eine Zuordnung in Frage kommen.
 *
 * Nur aktive: Wer ausgetreten ist, soll nicht mehr eingeteilt werden können –
 * in der Liste stünde er sonst zwischen den anderen, ohne dass es auffällt.
 */
function useMitarbeiter(nurSachkundige?: boolean) {
  const [mitarbeiter, setMitarbeiter] = useState<Employee[]>([]);

  useEffect(() => {
    let aktuell = true;

    api
      .list<Employee>('/employees', {
        pageSize: 200,
        active: true,
        sortBy: 'lastName',
        sortDir: 'asc',
        qualifiedInspectorsOnly: nurSachkundige || undefined,
      })
      .then((seite) => {
        if (aktuell) setMitarbeiter(seite.items);
      })
      .catch(() => setMitarbeiter([]));

    return () => {
      aktuell = false;
    };
  }, [nurSachkundige]);

  return mitarbeiter;
}

export function name(person: Pick<Employee, 'firstName' | 'lastName'>): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

/** Auswahl einer einzelnen Person, etwa des ausführenden Monteurs. */
export function EmployeePicker({
  value,
  onChange,
  id = 'employeeId',
  required,
  nurSachkundige,
  leerText = 'Noch offen',
}: {
  value: string;
  onChange: (employeeId: string) => void;
  id?: string;
  required?: boolean;
  /** Nur Sachkundige nach ASR A1.7 – für Prüfungen. */
  nurSachkundige?: boolean;
  leerText?: string;
}) {
  const mitarbeiter = useMitarbeiter(nurSachkundige);

  return (
    <Select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
    >
      <option value="">{leerText}</option>
      {mitarbeiter.map((person) => (
        <option key={person.id} value={person.id}>
          {person.employeeNumber} · {name(person)}
        </option>
      ))}
    </Select>
  );
}

/**
 * Einteilung mehrerer Personen, etwa für einen Termin.
 *
 * Bewusst Kästchen statt einer Mehrfachauswahl: Eine Mehrfachauswahl im
 * Browser verlangt gedrückte Steuerungstaste, und wer das nicht weiß, wirft
 * mit jedem Klick die vorige Wahl weg – bei einer Einteilung, die zwei Leute
 * an einen Einsatz bindet, ist das kein kleiner Fehler.
 */
export function EmployeeCheckboxes({
  values,
  onChange,
}: {
  values: string[];
  onChange: (ids: string[]) => void;
}) {
  const mitarbeiter = useMitarbeiter();

  if (mitarbeiter.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Es ist noch niemand angelegt. Mitarbeiter werden unter „Personal“ erfasst.
      </p>
    );
  }

  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {mitarbeiter.map((person) => (
        <label key={person.id} className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={values.includes(person.id)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...values, person.id]
                  : values.filter((eintrag) => eintrag !== person.id),
              )
            }
          />
          <span>
            {name(person)}
            {person.position && (
              <span className="block text-xs text-slate-500">{person.position}</span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
