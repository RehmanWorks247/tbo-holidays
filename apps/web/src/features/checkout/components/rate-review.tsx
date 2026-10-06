'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { RequestError } from '@/components/shared/request-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PriceSummary } from '@/features/booking/components/price-summary';
import { getIdempotencyKey } from '@/features/checkout/utils/idempotency-key';
import { requireSessionToken } from '@/services/api/api-client';
import { bookingsApi } from '@/services/api/bookings.api';
import { hotelsApi } from '@/services/api/hotels.api';

export function RateReview({ rateId }: { rateId: string }) {
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const recheck = useMutation({
    mutationFn: async () => hotelsApi.recheck(rateId, await requireSessionToken(getToken)),
  });
  const intent = useMutation({
    mutationFn: async () => {
      if (!recheck.data) throw new Error('Check the latest price before continuing.');
      return bookingsApi.create(
        {
          quoteId: recheck.data.id,
          idempotencyKey: getIdempotencyKey(`intent:${userId}:${recheck.data.id}`),
        },
        await requireSessionToken(getToken),
      );
    },
    onSuccess: (booking) => router.replace(`/checkout?bookingId=${booking.id}`),
  });
  return (
    <Card className="space-y-5">
      <h2 className="text-xl font-semibold">1. Confirm the latest price</h2>
      <p className="text-muted-foreground">
        We’ll check this room’s current price and availability before creating your reservation.
      </p>
      {!recheck.data ? (
        <Button onClick={() => recheck.mutate()} disabled={recheck.isPending}>
          {recheck.isPending ? 'Checking availability…' : 'Check latest price'}
        </Button>
      ) : (
        <>
          <h3 className="font-semibold">{recheck.data.hotel.name}</h3>
          <p>
            {recheck.data.checkIn} → {recheck.data.checkOut}
          </p>
          <PriceSummary price={recheck.data.price} />
          <p className="text-sm text-muted-foreground">
            Quote valid until {new Date(recheck.data.expiresAt).toLocaleTimeString()}. Availability
            is confirmed by the booking service.
          </p>
          <Button disabled={intent.isPending} onClick={() => intent.mutate()}>
            {intent.isPending ? 'Creating reservation…' : 'Accept price and continue'}
          </Button>
        </>
      )}
      {recheck.error ? <RequestError error={recheck.error} /> : null}
      {intent.error ? <RequestError error={intent.error} /> : null}
    </Card>
  );
}
