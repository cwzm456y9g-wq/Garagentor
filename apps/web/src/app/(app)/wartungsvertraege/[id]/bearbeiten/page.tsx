'use client';

import { use } from 'react';
import { ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { useApi } from '@/lib/hooks';
import type { MaintenanceContract } from '@/lib/types';
import { ContractForm } from '../../vertrag-form';

export default function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<MaintenanceContract>(
    `/maintenance-contracts/${id}`,
  );

  return (
    <div className="max-w-3xl">
      <PageHeader title="Wartungsvertrag bearbeiten" subtitle={data?.contractNumber} />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingState />
      ) : (
        <ContractForm vertrag={data} />
      )}
    </div>
  );
}
