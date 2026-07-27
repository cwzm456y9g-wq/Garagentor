/** Datums-Hilfsfunktionen ohne externe Abhängigkeiten (UTC-basiert). */

export function toDate(value: Date | string | number): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

export function startOfDay(value: Date | string): Date {
  const date = toDate(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value: Date | string): Date {
  const date = toDate(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function addDays(value: Date | string, days: number): Date {
  const date = toDate(value);
  date.setDate(date.getDate() + days);
  return date;
}

/** Addiert Monate und begrenzt den Tag auf das Monatsende (31.01. + 1 = 28.02.). */
export function addMonths(value: Date | string, months: number): Date {
  const date = toDate(value);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return date;
}

/** Volle Tage zwischen zwei Zeitpunkten (b - a). */
export function daysBetween(a: Date | string, b: Date | string): number {
  const millisPerDay = 86_400_000;
  return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / millisPerDay);
}

/** Tage, die ein Fälligkeitsdatum überschritten ist (0, wenn nicht überfällig). */
export function daysOverdue(dueDate: Date | string, reference: Date | string = new Date()): number {
  return Math.max(0, daysBetween(dueDate, reference));
}

export function isOverdue(dueDate: Date | string, reference: Date | string = new Date()): boolean {
  return startOfDay(reference).getTime() > startOfDay(dueDate).getTime();
}

/** Erster Tag des Monats. */
export function startOfMonth(value: Date | string = new Date()): Date {
  const date = startOfDay(value);
  date.setDate(1);
  return date;
}

/** Letzter Tag des Monats, 23:59:59.999. */
export function endOfMonth(value: Date | string = new Date()): Date {
  const date = startOfMonth(value);
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  return endOfDay(date);
}

export function startOfYear(value: Date | string = new Date()): Date {
  const date = startOfDay(value);
  date.setMonth(0, 1);
  return date;
}

export function endOfYear(value: Date | string = new Date()): Date {
  const date = startOfYear(value);
  date.setFullYear(date.getFullYear() + 1);
  return endOfDay(addDays(date, -1));
}

/** ISO-Kalenderwoche nach DIN 1355 / ISO 8601. */
export function isoWeek(value: Date | string = new Date()): number {
  const date = startOfDay(value);
  // Donnerstag der laufenden Woche bestimmt das Jahr.
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/** Datum als `YYYY-MM-DD` in lokaler Zeitzone. */
export function toIsoDate(value: Date | string): string {
  const date = toDate(value);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Periodenschlüssel `YYYY-MM` für Auswertungen. */
export function toPeriodKey(value: Date | string): string {
  const date = toDate(value);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

/**
 * Dauer in Stunden zwischen zwei Zeitpunkten abzüglich Pause,
 * gerundet auf zwei Nachkommastellen.
 */
export function durationHours(start: Date | string, end: Date | string, breakMinutes = 0): number {
  const millis = toDate(end).getTime() - toDate(start).getTime();
  const hours = millis / 3_600_000 - breakMinutes / 60;
  return Math.max(0, Math.round(hours * 100) / 100);
}
