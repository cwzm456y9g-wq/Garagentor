'use client';

import { roleLabels } from '@garagentor/shared';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { EmployeePicker } from '@/components/employee-picker';
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
  Table,
} from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useAction, useList } from '@/lib/hooks';
import type { Zugang } from '@/lib/types';

const LEER = {
  email: '',
  firstName: '',
  lastName: '',
  role: 'BUERO',
  password: '',
  employeeId: '',
};

/** So lang, dass es nicht zu erraten ist, und noch diktierbar. */
function passwortVorschlagen(): string {
  const zeichen = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const zufall = new Uint32Array(18);
  crypto.getRandomValues(zufall);

  const roh = [...zufall].map((wert) => zeichen[wert % zeichen.length]).join('');
  return `${roh.slice(0, 6)}-${roh.slice(6, 12)}-${roh.slice(12, 18)}`;
}

/**
 * Benutzerverwaltung.
 *
 * Ein Benutzer ist das Anmeldekonto, ein Mitarbeiter der Personaldatensatz –
 * beides gehört getrennt: Nicht jeder Mitarbeiter braucht einen Zugang, und
 * ein Zugang überlebt den Mitarbeiter nicht, wohl aber umgekehrt. Wo beides
 * zusammengehört, wird es hier verknüpft; erst dann sieht die Person unter
 * „Mein Tag" ihre eigenen Einsätze.
 *
 * Ein zweites Administratorkonto ist keine Spielerei, sondern Vorsorge: Geht
 * das einzige verloren, kommt niemand mehr an die Benutzerverwaltung.
 */
export default function UsersPage() {
  const { user } = useAuth();
  const zugaenge = useList<Zugang>('/users');
  const [neu, setNeu] = useState(LEER);
  const [offen, setOffen] = useState(false);
  const [angelegt, setAngelegt] = useState<{ email: string; passwort: string } | null>(null);
  const [neuesPasswort, setNeuesPasswort] = useState<{ email: string; passwort: string } | null>(
    null,
  );

  const anlegen = useAction((body: Record<string, unknown>) => api.post<Zugang>('/users', body));
  const aendern = useAction((args: { id: string; body: Record<string, unknown> }) =>
    api.patch<Zugang>(`/users/${args.id}`, args.body),
  );
  const zuruecksetzen = useAction((args: { id: string; newPassword: string }) =>
    api.post(`/users/${args.id}/reset-password`, { newPassword: args.newPassword }),
  );

  const istAdmin = user?.role === 'ADMIN';

  async function benutzerAnlegen(event: FormEvent) {
    event.preventDefault();

    const ergebnis = await anlegen.run({
      email: neu.email.trim(),
      firstName: neu.firstName.trim(),
      lastName: neu.lastName.trim(),
      role: neu.role,
      password: neu.password,
      employeeId: neu.employeeId || undefined,
    });

    if (ergebnis) {
      // Das Passwort wird hier ein einziges Mal gezeigt. Danach steht es nur
      // noch als Hash in der Datenbank und ist nicht mehr auslesbar.
      setAngelegt({ email: ergebnis.email, passwort: neu.password });
      setNeu(LEER);
      setOffen(false);
      zugaenge.reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Benutzer"
        subtitle="Anmeldekonten und ihre Rollen"
        actions={
          istAdmin && (
            <Button
              onClick={() => {
                setOffen((auf) => !auf);
                setAngelegt(null);
                if (!offen) setNeu({ ...LEER, password: passwortVorschlagen() });
              }}
            >
              {offen ? 'Abbrechen' : 'Benutzer anlegen'}
            </Button>
          )
        }
      />

      {!istAdmin && (
        <p className="meldung-hinweis mb-6">
          Nur ein Administrator darf Konten anlegen, Rollen ändern oder Passwörter zurücksetzen.
          Hier steht deshalb nur der Bestand.
        </p>
      )}

      {angelegt && (
        <Card title="Konto angelegt" className="mb-6">
          <p className="text-sm text-slate-700">
            Der Zugang für <strong>{angelegt.email}</strong> steht. Das Passwort lautet:
          </p>
          <p className="tabular mt-2 rounded-md bg-slate-100 px-3 py-2 font-mono text-base text-slate-900">
            {angelegt.passwort}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Es wird hier einmalig angezeigt und ist danach nicht mehr auslesbar – in der Datenbank
            liegt nur der Hash. Bitte sicher übergeben und beim ersten Anmelden ändern lassen.
          </p>
          <Button className="mt-4" size="sm" variant="secondary" onClick={() => setAngelegt(null)}>
            Verstanden
          </Button>
        </Card>
      )}

      {offen && istAdmin && (
        <Card title="Neues Anmeldekonto" className="mb-6">
          <form onSubmit={benutzerAnlegen} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vorname" htmlFor="firstName" required>
                <Input
                  id="firstName"
                  value={neu.firstName}
                  onChange={(e) => setNeu({ ...neu, firstName: e.target.value })}
                  required
                />
              </Field>
              <Field label="Nachname" htmlFor="lastName" required>
                <Input
                  id="lastName"
                  value={neu.lastName}
                  onChange={(e) => setNeu({ ...neu, lastName: e.target.value })}
                  required
                />
              </Field>
              <Field
                label="E-Mail"
                htmlFor="email"
                required
                hint="Damit meldet sich die Person an."
              >
                <Input
                  id="email"
                  type="email"
                  value={neu.email}
                  onChange={(e) => setNeu({ ...neu, email: e.target.value })}
                  required
                />
              </Field>
              <Field
                label="Rolle"
                htmlFor="role"
                hint="Administrator darf zusätzlich Benutzer verwalten."
              >
                <Select
                  id="role"
                  value={neu.role}
                  onChange={(e) => setNeu({ ...neu, role: e.target.value })}
                >
                  {Object.entries(roleLabels).map(([wert, text]) => (
                    <option key={wert} value={wert}>
                      {text}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Mitarbeiter"
                htmlFor="employeeId"
                hint="Verknüpft das Konto mit dem Personaldatensatz – nötig für „Mein Tag“."
              >
                <EmployeePicker
                  id="employeeId"
                  value={neu.employeeId}
                  onChange={(id) => setNeu({ ...neu, employeeId: id })}
                  leerText="Ohne Verknüpfung"
                />
              </Field>
              <Field
                label="Passwort"
                htmlFor="password"
                required
                hint="Mindestens 10 Zeichen. Der Vorschlag ist zufällig erzeugt."
              >
                <div className="flex gap-2">
                  <Input
                    id="password"
                    value={neu.password}
                    onChange={(e) => setNeu({ ...neu, password: e.target.value })}
                    minLength={10}
                    required
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setNeu({ ...neu, password: passwortVorschlagen() })}
                  >
                    Neu
                  </Button>
                </div>
              </Field>
            </div>

            {anlegen.error && <ErrorState message={anlegen.error} />}

            <Button type="submit" loading={anlegen.loading}>
              Konto anlegen
            </Button>
          </form>
        </Card>
      )}

      {neuesPasswort && (
        <Card title="Passwort zurückgesetzt" className="mb-6">
          <p className="text-sm text-slate-700">
            Neues Passwort für <strong>{neuesPasswort.email}</strong>:
          </p>
          <p className="tabular mt-2 rounded-md bg-slate-100 px-3 py-2 font-mono text-base text-slate-900">
            {neuesPasswort.passwort}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Alle offenen Sitzungen dieser Person wurden beendet.
          </p>
          <Button
            className="mt-4"
            size="sm"
            variant="secondary"
            onClick={() => setNeuesPasswort(null)}
          >
            Verstanden
          </Button>
        </Card>
      )}

      {(aendern.error ?? zuruecksetzen.error) && (
        <div className="mb-4">
          <ErrorState message={(aendern.error ?? zuruecksetzen.error)!} />
        </div>
      )}

      <Card title="Bestand" bodyClassName="">
        {zugaenge.loading ? (
          <LoadingState />
        ) : zugaenge.error ? (
          <ErrorState message={zugaenge.error} onRetry={zugaenge.reload} />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>E-Mail</th>
                <th>Rolle</th>
                <th>Zuletzt angemeldet</th>
                <th>Status</th>
                {istAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {(zugaenge.items ?? []).map((zugang) => (
                <tr key={zugang.id}>
                  <td className="font-medium text-slate-900">
                    {zugang.firstName} {zugang.lastName}
                    {zugang.id === user?.id && (
                      <span className="ml-2 text-xs text-slate-500">(Sie)</span>
                    )}
                  </td>
                  <td className="text-slate-700">{zugang.email}</td>
                  <td>
                    {istAdmin && zugang.id !== user?.id ? (
                      <Select
                        aria-label={`Rolle von ${zugang.email}`}
                        value={zugang.role}
                        className="max-w-48"
                        onChange={async (event) => {
                          if (
                            await aendern.run({ id: zugang.id, body: { role: event.target.value } })
                          )
                            zugaenge.reload();
                        }}
                      >
                        {Object.entries(roleLabels).map(([wert, text]) => (
                          <option key={wert} value={wert}>
                            {text}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="text-slate-600">{roleLabels[zugang.role]}</span>
                    )}
                  </td>
                  <td className="tabular text-slate-600">
                    {zugang.lastLoginAt
                      ? new Date(zugang.lastLoginAt).toLocaleString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'noch nie'}
                  </td>
                  <td>
                    {zugang.active ? (
                      <Badge tone="success">aktiv</Badge>
                    ) : (
                      <Badge tone="neutral">gesperrt</Badge>
                    )}
                  </td>
                  {istAdmin && (
                    <td className="whitespace-nowrap text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const passwort = passwortVorschlagen();
                          if (await zuruecksetzen.run({ id: zugang.id, newPassword: passwort })) {
                            setNeuesPasswort({ email: zugang.email, passwort });
                          }
                        }}
                      >
                        Passwort zurücksetzen
                      </Button>
                      {zugang.id !== user?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (
                              await aendern.run({
                                id: zugang.id,
                                body: { active: !zugang.active },
                              })
                            )
                              zugaenge.reload();
                          }}
                        >
                          {zugang.active ? 'Sperren' : 'Freigeben'}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="mt-6 text-sm text-slate-500">
        <Link href="/einstellungen" className="text-verweis hover:underline">
          ← Zurück zu den Einstellungen
        </Link>
      </p>
    </>
  );
}
