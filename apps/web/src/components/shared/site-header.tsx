import { BedDouble } from 'lucide-react';
import Link from 'next/link';

import { SessionNavigation } from '@/features/authentication/components/session-navigation';

export function SiteHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <BedDouble aria-hidden="true" size={23} />
          Stayline
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-5 text-sm">
          <Link href="/hotels">Find a hotel</Link>
          <Link href="/bookings">My bookings</Link>
          <SessionNavigation />
        </nav>
      </div>
    </header>
  );
}
