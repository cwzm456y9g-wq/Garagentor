'use client';

import { customerDisplayName } from '@garagentor/shared';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { Customer } from '@/lib/types';
import { Select } from './ui';

/**
 * Auswahl eines Kunden. Die Liste wird einmalig geladen; für sehr große
 * Kundenstämme wäre eine serverseitige Suche vorzuziehen.
 */
export function CustomerPicker({
  value,
  onChange,
  id = 'customerId',
  required,
}: {
  value: string;
  onChange: (customerId: string) => void;
  id?: string;
  required?: boolean;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    let active = true;

    api
      .list<Customer>('/customers', {
        pageSize: 200,
        active: true,
        sortBy: 'customerNumber',
        sortDir: 'asc',
      })
      .then((page) => {
        if (active) setCustomers(page.items);
      })
      .catch(() => setCustomers([]));

    return () => {
      active = false;
    };
  }, []);

  return (
    <Select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
    >
      <option value="">Bitte wählen …</option>
      {customers.map((customer) => (
        <option key={customer.id} value={customer.id}>
          {customer.customerNumber} · {customerDisplayName(customer)}
        </option>
      ))}
    </Select>
  );
}
