'use client';

import { PageHeader } from '@/components/ui';
import { CustomerForm } from '../customer-form';

export default function NewCustomerPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Kunde anlegen" subtitle="Die Kundennummer wird automatisch vergeben." />
      <CustomerForm />
    </div>
  );
}
