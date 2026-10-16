'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { RequestError } from '@/components/shared/request-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PriceSummary } from '@/features/booking/components/price-summary';
import { getIdempotencyKey } from '@/features/checkout/utils/idempotency-key';
import { formatDate, formatDateTime } from '@/lib/format-date';
import { usePageMessages } from '@/providers/use-page-messages';
import { requireSessionToken } from '@/services/api/api-client';
import { bookingsApi } from '@/services/api/bookings.api';
import { hotelsApi } from '@/services/api/hotels.api';

export function RateReview({ rateId }: { rateId: string }) {
  const {
    messages: { booking: copy },
    locale,
    dir,
    t,
  } = usePageMessages();
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const recheck = useMutation({
    mutationFn: async () => hotelsApi.recheck(rateId, await requireSessionToken(getToken)),
  });
  const intent = useMutation({
    mutationFn: async () => {
      if (!recheck.data) throw new Error(copy.rate.checkBeforeContinuing);
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
    <Card className="space-y-5" lang={locale} dir={dir}>
      <h2 className="text-xl font-semibold">{copy.rate.title}</h2>
      <p className="text-muted-foreground">{copy.rate.description}</p>
      {!recheck.data ? (
        <Button onClick={() => recheck.mutate()} disabled={recheck.isPending}>
          {recheck.isPending ? copy.rate.checking : copy.rate.checkPrice}
        </Button>
      ) : (
        <>
          <h3 className="font-semibold">{recheck.data.hotel.name}</h3>
          <p>
            {formatDate(recheck.data.checkIn, locale)} → {formatDate(recheck.data.checkOut, locale)}
          </p>
          <PriceSummary price={recheck.data.price} />
          <p className="text-sm text-muted-foreground">
            {t(copy.rate.quoteValidity, {
              expires: formatDateTime(recheck.data.expiresAt, locale),
            })}
          </p>
          <Button disabled={intent.isPending} onClick={() => intent.mutate()}>
            {intent.isPending ? copy.rate.creating : copy.rate.accept}
          </Button>
        </>
      )}
      {recheck.error ? <RequestError error={recheck.error} /> : null}
      {intent.error ? <RequestError error={intent.error} /> : null}
    </Card>
  );
}
