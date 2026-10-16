'use client';

import { useAuth } from '@clerk/nextjs';
import { paymentStatusSchema, type UpdateBookingGuestsRequest } from '@hotel/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

import { RequestError } from '@/components/shared/request-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PriceSummary } from '@/features/booking/components/price-summary';
import { bookingKeys, useBooking } from '@/features/booking/queries/use-bookings';
import { statusLabel } from '@/features/booking/utils/status-label';
import { GuestDetailsForm } from '@/features/checkout/components/guest-details-form';
import {
  getIdempotencyKey,
  validateCheckoutRedirect,
} from '@/features/checkout/utils/idempotency-key';
import { formatDate } from '@/lib/format-date';
import { usePageMessages } from '@/providers/use-page-messages';
import { requireSessionToken } from '@/services/api/api-client';
import { bookingsApi } from '@/services/api/bookings.api';
import { paymentsApi } from '@/services/api/payments.api';

export function BookingCheckout({ bookingId }: { bookingId: string }) {
  const {
    messages: { booking: copy },
    locale,
    dir,
    t,
  } = usePageMessages();
  const { getToken, userId } = useAuth();
  const queryClient = useQueryClient();
  const booking = useBooking(bookingId);
  const payment = useMutation({
    mutationFn: async (guests: UpdateBookingGuestsRequest | undefined) => {
      const token = await requireSessionToken(getToken);
      if (guests) {
        const updated = await bookingsApi.updateGuests(bookingId, guests, token);
        queryClient.setQueryData(bookingKeys.detail(userId, bookingId), updated);
      }
      const checkout = await paymentsApi.checkout(
        { bookingId, idempotencyKey: getIdempotencyKey(`checkout:${userId}:${bookingId}`) },
        token,
      );
      if (checkout.redirectUrl)
        window.location.assign(validateCheckoutRedirect(checkout.redirectUrl));
      return checkout;
    },
  });
  if (booking.isPending) return <Skeleton className="h-64" />;
  if (booking.error) return <RequestError error={booking.error} />;
  const data = booking.data;
  if (data.bookingStatus !== 'BOOKING_PENDING' || data.paymentStatus === 'PAYMENT_SUCCEEDED')
    return (
      <Card className="space-y-4" lang={locale} dir={dir}>
        <p>{copy.checkout.progressed}</p>
        <Button asChild>
          <Link href={`/booking/${bookingId}`}>{copy.list.viewBooking}</Link>
        </Button>
      </Card>
    );
  const checkoutStatus = paymentStatusSchema.safeParse(payment.data?.status);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]" lang={locale} dir={dir}>
      <Card className="space-y-6">
        <h2 className="text-xl font-semibold">{copy.checkout.title}</h2>
        {data.guests.length > 0 ? (
          <div className="space-y-3 rounded-md border p-4">
            <p className="text-sm text-muted-foreground">{copy.checkout.savedGuests}</p>
            <Button
              type="button"
              variant="outline"
              disabled={payment.isPending}
              onClick={() => payment.mutate(undefined)}
            >
              {copy.checkout.continueSaved}
            </Button>
          </div>
        ) : null}
        <GuestDetailsForm
          booking={data}
          pending={payment.isPending}
          onSubmit={(guests) => payment.mutate(guests)}
        />
        {payment.error ? <RequestError error={payment.error} /> : null}
        {payment.data ? (
          <div role="status" className="space-y-2">
            <p>
              {t(copy.checkout.status, {
                status: checkoutStatus.success
                  ? statusLabel(checkoutStatus.data, copy.statuses)
                  : copy.checkout.statusUnavailable,
              })}
            </p>
            <Link className="underline" href={`/booking/${bookingId}`}>
              {copy.checkout.viewStatus}
            </Link>
          </div>
        ) : null}
      </Card>
      <Card className="space-y-4">
        <h3 className="font-semibold">{data.hotel.name}</h3>
        <p className="text-sm">
          {formatDate(data.checkIn, locale)} → {formatDate(data.checkOut, locale)}
        </p>
        <PriceSummary price={data.price} />
      </Card>
    </div>
  );
}
