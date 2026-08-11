'use client';

import { PageHeader } from '@/components/ui';
import { AppointmentForm } from '../termin-form';

export default function NewAppointmentPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Termin anlegen"
        subtitle="Der Einsatz erscheint bei den eingeteilten Mitarbeitern unter „Mein Tag“."
      />
      <AppointmentForm />
    </div>
  );
}
