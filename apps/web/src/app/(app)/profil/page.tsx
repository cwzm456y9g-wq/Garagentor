'use client';

import { roleLabels } from '@garagentor/shared';
import { useState, type FormEvent } from 'react';
import { Button, Card, Field, Input, PageHeader } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useAction } from '@/lib/hooks';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const change = useAction((body: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', body),
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setDone(false);

    if (newPassword !== repeat) {
      setMismatch('Die beiden Eingaben stimmen nicht überein.');
      return;
    }
    setMismatch(null);

    const result = await change.run({ currentPassword, newPassword });
    if (result !== null) {
      setDone(true);
      // Die Passwortänderung beendet serverseitig alle Sitzungen.
      setTimeout(() => void logout(), 2500);
    }
  }

  return (
    <>
      <PageHeader title="Mein Konto" subtitle="Angaben zum angemeldeten Benutzer" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Benutzer">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">
                {user?.firstName} {user?.lastName}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">E-Mail</dt>
              <dd className="text-slate-900">{user?.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Rolle</dt>
              <dd className="text-slate-900">{user ? roleLabels[user.role] : '–'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Mitarbeiterbezug</dt>
              <dd className="text-slate-900">
                {user?.employeeId ? 'vorhanden' : 'nicht verknüpft'}
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="Passwort ändern">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Aktuelles Passwort" htmlFor="current" required>
              <Input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>

            <Field label="Neues Passwort" htmlFor="new" hint="Mindestens 10 Zeichen." required>
              <Input
                id="new"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={10}
                required
              />
            </Field>

            <Field
              label="Neues Passwort wiederholen"
              htmlFor="repeat"
              error={mismatch ?? undefined}
              required
            >
              <Input
                id="repeat"
                type="password"
                value={repeat}
                onChange={(event) => setRepeat(event.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>

            {change.error && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {change.error}
              </div>
            )}

            {done && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Das Passwort wurde geändert. Aus Sicherheitsgründen werden alle Sitzungen beendet –
                Sie werden gleich abgemeldet.
              </div>
            )}

            <Button type="submit" loading={change.loading}>
              Passwort ändern
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
