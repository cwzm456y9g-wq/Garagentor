'use client';

import { use } from 'react';
import { ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { useApi } from '@/lib/hooks';
import type { Employee } from '@/lib/types';
import { EmployeeForm } from '../../employee-form';

export default function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<Employee>(`/employees/${id}`);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Mitarbeiter bearbeiten" subtitle={data?.employeeNumber} />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingState />
      ) : (
        <EmployeeForm employee={data} />
      )}
    </div>
  );
}
