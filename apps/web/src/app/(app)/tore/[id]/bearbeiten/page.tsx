'use client';

import { use } from 'react';
import { ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { useApi } from '@/lib/hooks';
import type { Door } from '@/lib/types';
import { DoorForm } from '../../door-form';

export default function EditDoorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<Door>(`/doors/${id}`);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Toranlage bearbeiten" subtitle={data?.doorNumber} />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingState />
      ) : (
        <DoorForm door={data} />
      )}
    </div>
  );
}
