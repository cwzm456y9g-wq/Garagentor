'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { LoadingState, PageHeader } from '@/components/ui';
import { DoorForm } from '../door-form';

/**
 * Der Kunde lässt sich über `?kunde=…` vorbelegen – so führt der Weg aus der
 * Kundenakte direkt hierher, ohne ihn erneut zu suchen.
 */
function Inhalt() {
  const kunde = useSearchParams().get('kunde') ?? undefined;
  return <DoorForm kunde={kunde} />;
}

export default function NewDoorPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Toranlage anlegen"
        subtitle="Die Anlagennummer wird automatisch vergeben."
      />
      {/* useSearchParams verlangt eine Grenze, hinter der clientseitig
          nachgeladen werden darf. */}
      <Suspense fallback={<LoadingState />}>
        <Inhalt />
      </Suspense>
    </div>
  );
}
