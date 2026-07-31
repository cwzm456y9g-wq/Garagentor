import { redirect } from 'next/navigation';

/** Die Startseite verweist auf das Dashboard innerhalb der Shell. */
export default function Home() {
  redirect('/dashboard');
}
