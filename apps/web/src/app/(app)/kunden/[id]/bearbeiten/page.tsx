'use client';

import { use } from 'react';
import { ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { useApi } from '@/lib/hooks';
import type { Customer } from '@/lib/types';
import { CustomerForm } from '../../customer-form';

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<Customer>(`/customers/${id}`);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Kunde bearbeiten" subtitle={data ? `${data.customerNumber}` : undefined} />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingState />
      ) : (
        <CustomerForm customer={data} />
      )}
    </div>
  );
}
