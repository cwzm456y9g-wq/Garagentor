'use client';

import { PageHeader } from '@/components/ui';
import { SupplierForm } from '../lieferant-form';

export default function NewSupplierPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Lieferant anlegen"
        subtitle="Die Lieferantennummer wird automatisch vergeben."
      />
      <SupplierForm />
    </div>
  );
}
