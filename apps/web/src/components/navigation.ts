import type { Role } from '@garagentor/shared';

export interface NavItem {
  label: string;
  href: string;
  /** Ohne Angabe für alle Rollen sichtbar. */
  roles?: Role[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * Aufbau der Seitennavigation. Die Gruppen folgen dem Arbeitsalltag im
 * Betrieb: erst der Vertrieb, dann die Ausführung, danach die Verwaltung.
 */
export const NAVIGATION: NavGroup[] = [
  {
    title: 'Übersicht',
    items: [{ label: 'Dashboard', href: '/dashboard' }],
  },
  {
    title: 'Vertrieb',
    items: [
      { label: 'Kunden', href: '/kunden' },
      { label: 'Angebote', href: '/angebote' },
      { label: 'Aufträge', href: '/auftraege' },
    ],
  },
  {
    title: 'Toranlagen',
    items: [
      { label: 'Anlagen', href: '/tore' },
      { label: 'Prüfungen', href: '/pruefungen' },
      { label: 'Mängel', href: '/maengel' },
      { label: 'Serviceberichte', href: '/serviceberichte' },
      { label: 'Wartungsverträge', href: '/wartungsvertraege' },
    ],
  },
  {
    title: 'Abwicklung',
    items: [
      { label: 'Termine', href: '/termine' },
      { label: 'Projekte', href: '/projekte' },
      { label: 'Zeiterfassung', href: '/zeiterfassung' },
    ],
  },
  {
    title: 'Buchhaltung',
    items: [
      {
        label: 'Rechnungen',
        href: '/rechnungen',
        roles: ['GESCHAEFTSFUEHRUNG', 'BUERO', 'BUCHHALTUNG'],
      },
      {
        label: 'Mahnwesen',
        href: '/mahnwesen',
        roles: ['GESCHAEFTSFUEHRUNG', 'BUERO', 'BUCHHALTUNG'],
      },
      {
        label: 'Postausgang',
        href: '/postausgang',
        roles: ['GESCHAEFTSFUEHRUNG', 'BUERO', 'BUCHHALTUNG'],
      },
    ],
  },
  {
    title: 'Material',
    items: [
      { label: 'Lager', href: '/lager' },
      { label: 'Lieferanten', href: '/lieferanten' },
      { label: 'Bestellungen', href: '/bestellungen' },
    ],
  },
  {
    title: 'Verwaltung',
    items: [
      { label: 'Personal', href: '/personal', roles: ['GESCHAEFTSFUEHRUNG', 'BUERO'] },
      { label: 'Abwesenheiten', href: '/abwesenheiten' },
      { label: 'Dokumente', href: '/dokumente' },
      {
        label: 'Auswertungen',
        href: '/auswertungen',
        roles: ['GESCHAEFTSFUEHRUNG', 'BUERO', 'BUCHHALTUNG'],
      },
      { label: 'Einstellungen', href: '/einstellungen', roles: ['GESCHAEFTSFUEHRUNG'] },
    ],
  },
];
