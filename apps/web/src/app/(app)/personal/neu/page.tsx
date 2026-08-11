'use client';

import { PageHeader } from '@/components/ui';
import { EmployeeForm } from '../employee-form';

export default function NewEmployeePage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Mitarbeiter anlegen"
        subtitle="Die Personalnummer wird automatisch vergeben. Sachkundenachweise kommen danach in der Personalakte dazu."
      />
      <EmployeeForm />
    </div>
  );
}
