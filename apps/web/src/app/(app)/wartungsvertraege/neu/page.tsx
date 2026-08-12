'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { LoadingState, PageHeader } from '@/components/ui';
import { ContractForm } from '../vertrag-form';

function Inhalt() {
  const kunde = useSearchParams().get('kunde') ?? undefined;
  return <ContractForm kunde={kunde} />;
}

export default function NewContractPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Wartungsvertrag anlegen"
        subtitle="Die Vertragsnummer wird automatisch vergeben. Der nächste Wartungstermin ergibt sich aus dem Intervall."
      />
      <Suspense fallback={<LoadingState />}>
        <Inhalt />
      </Suspense>
    </div>
  );
}
