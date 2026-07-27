/** Formatierung für die deutsche Locale. */

const LOCALE = 'de-DE';

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatCurrency(value: number | null | undefined): string {
  return currencyFormatter.format(value ?? 0);
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '–';
  if (decimals === 2) return numberFormatter.format(value);
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '–';
  return `${formatNumber(value, decimals)} %`;
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '–';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '–' : dateFormatter.format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '–';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '–' : dateTimeFormatter.format(date);
}

export function formatTime(value: Date | string | null | undefined): string {
  if (!value) return '–';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '–' : timeFormatter.format(date);
}

/** Stunden als `7:45 h`. */
export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '–';
  const sign = hours < 0 ? '-' : '';
  const total = Math.round(Math.abs(hours) * 60);
  return `${sign}${Math.floor(total / 60)}:${`${total % 60}`.padStart(2, '0')} h`;
}

/** Vollständiger Anzeigename eines Kunden – Firma hat Vorrang. */
export function customerDisplayName(customer: {
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  if (customer.companyName) return customer.companyName;
  return [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Unbenannt';
}

/** Adresse einzeilig. */
export function formatAddress(address: {
  street?: string | null;
  zip?: string | null;
  city?: string | null;
}): string {
  const line = [address.street, [address.zip, address.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  return line || '–';
}

/** Initialen für Avatare. */
export function initials(firstName?: string | null, lastName?: string | null): string {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
}
