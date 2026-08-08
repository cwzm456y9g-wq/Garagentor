'use client';

import { initials, roleLabels } from '@garagentor/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DarstellungWahl } from './darstellung';
import { GlobalSearch } from './global-search';
import { NAVIGATION } from './navigation';
import { Button, cx, LoadingState } from './ui';

/**
 * Rahmen aller angemeldeten Seiten: Seitennavigation, Kopfzeile mit globaler
 * Suche und Benutzermenü. Nicht angemeldete Aufrufe landen auf der Anmeldung.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout, hasRole } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Beim Seitenwechsel schließt die mobile Navigation.
  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Sitzung wird geprüft …" />
      </div>
    );
  }

  if (!user) {
    // Die Weiterleitung übernimmt der Wächter in der Layout-Komponente.
    return null;
  }

  const groups = NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || hasRole(...item.roles)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-screen">
      {/* Verdunkelung hinter der mobilen Navigation */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Navigation schließen"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden"
        />
      )}

      <aside
        className={cx(
          'bg-marine-900 fixed inset-y-0 left-0 z-30 flex w-64 flex-col transition-transform',
          'lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="border-marine-800 flex h-14 items-center gap-2.5 border-b px-5">
          <span className="bg-bernstein-500 flex h-7 w-7 items-center justify-center rounded">
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-white" aria-hidden="true">
              <path
                fill="currentColor"
                d="M2 7.5 10 3l8 4.5V17a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.5Zm3 2.5h10v1.5H5V10Zm0 3h10v1.5H5V13Z"
              />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">Garagentor</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Hauptnavigation">
          {groups.map((group) => (
            <div key={group.title} className="mb-5">
              <p className="text-marine-400 px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cx(
                          'block rounded-md px-2.5 py-1.5 text-sm transition-colors',
                          active
                            ? 'bg-marine-700 font-medium text-white'
                            : 'text-marine-200 hover:bg-marine-800 hover:text-white',
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-slate-200 bg-flaeche px-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Navigation öffnen"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
              <path fill="currentColor" d="M3 5h14v2H3V5Zm0 4h14v2H3V9Zm0 4h14v2H3v-2Z" />
            </svg>
          </button>

          <GlobalSearch />

          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-100"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span
                className="bg-marine-700 flex h-7 w-7 items-center justify-center rounded-full
                  text-xs font-semibold text-white"
              >
                {initials(user.firstName, user.lastName)}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium leading-tight text-slate-900">
                  {user.firstName} {user.lastName}
                </span>
                <span className="block text-xs leading-tight text-slate-500">
                  {roleLabels[user.role]}
                </span>
              </span>
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-slate-200
                  bg-flaeche py-1 shadow-lg"
              >
                <div className="border-b border-slate-100 px-4 py-2">
                  <p className="truncate text-sm font-medium text-slate-900">{user.email}</p>
                  <p className="text-xs text-slate-500">{roleLabels[user.role]}</p>
                </div>
                <Link
                  href="/profil"
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  role="menuitem"
                >
                  Passwort ändern
                </Link>
                <div className="border-t border-slate-100 px-4 py-3">
                  <p className="mb-1.5 text-xs font-medium text-slate-500">Darstellung</p>
                  <DarstellungWahl />
                </div>
                <div className="px-2 pb-1 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => void logout()}
                  >
                    Abmelden
                  </Button>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
