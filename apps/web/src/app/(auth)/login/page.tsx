'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Eine bestehende Sitzung überspringt die Anmeldung.
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.messages.join(' ')
          : 'Die Anmeldung ist fehlgeschlagen. Bitte später erneut versuchen.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="from-marine-900 to-marine-950 flex min-h-screen items-center justify-center bg-gradient-to-br px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="bg-bernstein-500 flex h-9 w-9 items-center justify-center rounded-md">
            <svg viewBox="0 0 20 20" className="h-5 w-5 text-white" aria-hidden="true">
              <path
                fill="currentColor"
                d="M2 7.5 10 3l8 4.5V17a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.5Zm3 2.5h10v1.5H5V10Zm0 3h10v1.5H5V13Z"
              />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">Garagentor</span>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-xl">
          <h1 className="text-lg font-semibold text-slate-900">Anmeldung</h1>
          <p className="mt-1 text-sm text-slate-600">
            Bitte melden Sie sich mit Ihren Zugangsdaten an.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Field label="E-Mail-Adresse" htmlFor="email" required>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </Field>

            <Field label="Passwort" htmlFor="password" required>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>

            {error && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {error}
              </div>
            )}

            <Button type="submit" loading={submitting} className="w-full">
              Anmelden
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/60">
          Betriebsinterne Anwendung. Zugänge vergibt die Geschäftsführung.
        </p>
      </div>
    </main>
  );
}
