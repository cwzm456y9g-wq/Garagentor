'use client';

import { PageHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        title={`Guten Tag, ${user?.firstName ?? ''}`}
        subtitle="Die Kennzahlen folgen im nächsten Schritt."
      />
    </>
  );
}
