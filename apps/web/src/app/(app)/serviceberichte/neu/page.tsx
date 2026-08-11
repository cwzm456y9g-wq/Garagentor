'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { LoadingState, PageHeader } from '@/components/ui';
import { ServiceReportForm } from '../bericht-form';

/** Die Anlage lässt sich über `?tor=…` vorbelegen – aus der Anlagenakte heraus. */
function Inhalt() {
  const tor = useSearchParams().get('tor') ?? undefined;
  return <ServiceReportForm tor={tor} />;
}

export default function NewServiceReportPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Servicebericht anlegen"
        subtitle="Unterschrift, Fotos und Materialabbuchung folgen beim Abschluss vor Ort."
      />
      <Suspense fallback={<LoadingState />}>
        <Inhalt />
      </Suspense>
    </div>
  );
}
