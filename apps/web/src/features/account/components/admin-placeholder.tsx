'use client';

import Link from 'next/link';

import { RequestError } from '@/components/shared/request-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccount } from '@/features/account/queries/use-account';
import { usePageMessages } from '@/providers/use-page-messages';

export function AdminPlaceholder({ bookings = false }: { bookings?: boolean }) {
  const {
    messages: { results: messages },
  } = usePageMessages();
  const account = useAccount();
  if (account.isPending)
    return (
      <div role="status" aria-label={messages.loadingAccount}>
        <Skeleton className="h-40" />
      </div>
    );
  if (account.error) return <RequestError error={account.error} />;
  if (account.data.role !== 'ADMIN')
    return (
      <Card>
        <p role="alert">{messages.administratorsOnly}</p>
      </Card>
    );
  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">
        {bookings ? messages.bookingOperations : messages.administration}
      </h2>
      <p className="text-muted-foreground">
        {bookings ? messages.bookingOperationsDescription : messages.administrationDescription}
      </p>
      {!bookings ? (
        <Button asChild variant="outline">
          <Link href="/admin/bookings">{messages.bookingOperations}</Link>
        </Button>
      ) : null}
    </Card>
  );
}
