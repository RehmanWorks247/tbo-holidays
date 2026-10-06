'use client';

import { useAuth } from '@clerk/nextjs';
import type { UpdateBookingGuestsRequest } from '@hotel/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

import { RequestError } from '@/components/shared/request-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PriceSummary } from '@/features/booking/components/price-summary';
import { bookingKeys, useBooking } from '@/features/booking/queries/use-bookings';
import { GuestDetailsForm } from '@/features/checkout/components/guest-details-form';
import {
  getIdempotencyKey,
  validateCheckoutRedirect,
} from '@/features/checkout/utils/idempotency-key';
import { requireSessionToken } from '@/services/api/api-client';
import { bookingsApi } from '@/services/api/bookings.api';
import { paymentsApi } from '@/services/api/payments.api';

export function BookingCheckout({ bookingId }: { bookingId: string }) {
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
      <Card className="space-y-4">
        <p>
          This booking has moved beyond guest checkout. Open its details for the current status.
        </p>
        <Button asChild>
          <Link href={`/booking/${bookingId}`}>View booking</Link>
        </Button>
      </Card>
    );
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
      <Card className="space-y-6">
        <h2 className="text-xl font-semibold">2. Guest details and payment</h2>
        {data.guests.length > 0 ? (
          <div className="space-y-3 rounded-md border p-4">
            <p className="text-sm text-muted-foreground">
              Guest details are saved. Resume an existing checkout here if a payment attempt was
              interrupted.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={payment.isPending}
              onClick={() => payment.mutate(undefined)}
            >
              Continue payment with saved guest details
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
              Checkout status: {payment.data.status}. Your booking is confirmed only after the hotel
              accepts it.
            </p>
            <Link className="underline" href={`/booking/${bookingId}`}>
              View booking status
            </Link>
          </div>
        ) : null}
      </Card>
      <Card className="space-y-4">
        <h3 className="font-semibold">{data.hotel.name}</h3>
        <p className="text-sm">
          {data.checkIn} → {data.checkOut}
        </p>
        <PriceSummary price={data.price} />
      </Card>
    </div>
  );
}
