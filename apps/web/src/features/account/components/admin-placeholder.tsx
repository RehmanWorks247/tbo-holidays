'use client';

import Link from 'next/link';

import { RequestError } from '@/components/shared/request-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccount } from '@/features/account/queries/use-account';

export function AdminPlaceholder({ bookings = false }: { bookings?: boolean }) {
  const account = useAccount();
  if (account.isPending) return <Skeleton className="h-40" />;
  if (account.error) return <RequestError error={account.error} />;
  if (account.data.role !== 'ADMIN')
    return (
      <Card>
        <p role="alert">This area is available to administrators only.</p>
      </Card>
    );
  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">{bookings ? 'Booking operations' : 'Administration'}</h2>
      <p className="text-muted-foreground">
        {bookings
          ? 'The booking operations workspace will be added here. Booking and payment changes remain controlled by the server.'
          : 'This space is reserved for hotel and booking operations.'}
      </p>
      {!bookings ? (
        <Button asChild variant="outline">
          <Link href="/admin/bookings">Booking operations</Link>
        </Button>
      ) : null}
    </Card>
  );
}
