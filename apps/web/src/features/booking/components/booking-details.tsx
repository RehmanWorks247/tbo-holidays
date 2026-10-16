'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { PageHeading } from '@/components/shared/page-heading';
import { RequestError } from '@/components/shared/request-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PriceSummary } from '@/features/booking/components/price-summary';
import { bookingKeys, useBooking } from '@/features/booking/queries/use-bookings';
import { statusLabel } from '@/features/booking/utils/status-label';
import { formatDate } from '@/lib/format-date';
import { usePageMessages } from '@/providers/use-page-messages';
import { requireSessionToken } from '@/services/api/api-client';
import { bookingsApi } from '@/services/api/bookings.api';

export function BookingDetails({ bookingId }: { bookingId: string }) {
  const {
    messages: { booking: copy },
    locale,
    dir,
    t,
  } = usePageMessages();
  const { userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  const booking = useBooking(bookingId);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancellation = useMutation({
    mutationFn: async () => bookingsApi.cancel(bookingId, await requireSessionToken(getToken)),
    onSuccess: async (data) => {
      queryClient.setQueryData(bookingKeys.detail(userId, bookingId), data);
      await queryClient.invalidateQueries({ queryKey: bookingKeys.list(userId) });
      setConfirmCancel(false);
    },
  });
  if (booking.isPending) return <Skeleton className="h-60" />;
  if (booking.error) return <RequestError error={booking.error} />;
  const data = booking.data;
  return (
    <div className="space-y-6" lang={locale} dir={dir}>
      <PageHeading
        title={data.hotel.name}
        description={t(copy.details.reference, { reference: data.id })}
      />
      <Card className="space-y-5">
        <p className="font-medium">{statusLabel(data.bookingStatus, copy.statuses)}</p>
        <p>
          {formatDate(data.checkIn, locale)} → {formatDate(data.checkOut, locale)}
        </p>
        <p className="text-sm text-muted-foreground">
          {statusLabel(data.paymentStatus, copy.statuses)}
        </p>
        <PriceSummary price={data.price} />
        {data.bookingStatus === 'RECONCILIATION_REQUIRED' ? (
          <p role="status">{copy.details.reconciliation}</p>
        ) : null}
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">{copy.details.roomsAndGuests}</h2>
        {data.rooms.map((room) => (
          <div key={room.roomIndex}>
            <p>{room.name}</p>
            <p className="text-sm text-muted-foreground">
              {t(copy.details.occupancy, {
                adults: room.adults,
                children: room.childrenAges.length,
              })}
            </p>
          </div>
        ))}
        {data.guests.map((guest, index) => (
          <p key={index} className="text-sm">
            {guest.firstName} {guest.lastName}
            {guest.leadGuest ? ` · ${copy.details.leadGuest}` : ''}
          </p>
        ))}
      </Card>
      {data.bookingStatus === 'BOOKING_PENDING' && data.paymentStatus !== 'PAYMENT_SUCCEEDED' ? (
        <Button asChild>
          <Link href={`/checkout?bookingId=${data.id}`}>{copy.details.continueCheckout}</Link>
        </Button>
      ) : null}
      {data.bookingStatus === 'BOOKING_CONFIRMED' ? (
        <div className="space-y-3">
          {confirmCancel ? (
            <Card className="space-y-4">
              <p>{copy.details.cancellationQuestion}</p>
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  disabled={cancellation.isPending}
                  onClick={() => cancellation.mutate()}
                >
                  {cancellation.isPending
                    ? copy.details.requesting
                    : copy.details.confirmCancellation}
                </Button>
                <Button variant="outline" onClick={() => setConfirmCancel(false)}>
                  {copy.details.keepBooking}
                </Button>
              </div>
            </Card>
          ) : (
            <Button variant="outline" onClick={() => setConfirmCancel(true)}>
              {copy.details.requestCancellation}
            </Button>
          )}
        </div>
      ) : null}
      {cancellation.error ? <RequestError error={cancellation.error} /> : null}
    </div>
  );
}
