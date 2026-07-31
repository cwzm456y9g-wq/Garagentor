import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <p className="text-marine-600 text-sm font-semibold">Fehler 404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Seite nicht gefunden</h1>
        <p className="mt-2 text-sm text-slate-600">
          Die aufgerufene Seite existiert nicht oder wurde verschoben.
        </p>
        <Link
          href="/dashboard"
          className="bg-marine-700 hover:bg-marine-800 mt-6 inline-block rounded-md px-4 py-2
            text-sm font-medium text-white"
        >
          Zum Dashboard
        </Link>
      </div>
    </main>
  );
}
