'use client';

import { use } from 'react';
import { ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { useApi } from '@/lib/hooks';
import type { Supplier } from '@/lib/types';
import { SupplierForm } from '../../lieferant-form';

export default function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<Supplier>(`/suppliers/${id}`);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Lieferant bearbeiten"
        subtitle={data ? `${data.supplierNumber} · ${data.name}` : undefined}
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingState />
      ) : (
        <SupplierForm lieferant={data} />
      )}
    </div>
  );
}
