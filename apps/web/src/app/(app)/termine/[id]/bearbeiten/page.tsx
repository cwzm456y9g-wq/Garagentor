'use client';

import { use } from 'react';
import { ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { useApi } from '@/lib/hooks';
import type { Appointment } from '@/lib/types';
import { AppointmentForm } from '../../termin-form';

export default function EditAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<Appointment>(`/appointments/${id}`);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Termin bearbeiten"
        subtitle="Verschieben und Umbesetzen ist Alltag – die Einteilung lässt sich hier ändern."
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingState />
      ) : (
        <AppointmentForm termin={data} />
      )}
    </div>
  );
}
