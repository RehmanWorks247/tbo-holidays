'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { PageHeading } from '@/components/shared/page-heading';
import { RequestError } from '@/components/shared/request-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useHotelSearch } from '@/features/hotel-search/queries/use-hotel-search';
import { parseHotelSearch } from '@/features/hotel-search/utils/search-params';
import { formatMoney } from '@/lib/format-money';
import { hotelsApi } from '@/services/api/hotels.api';

export function HotelDetails({ hotelId }: { hotelId: string }) {
  const params = useSearchParams();
  const request = parseHotelSearch(params);
  const details = useQuery({
    queryKey: ['hotel', hotelId],
    queryFn: ({ signal }) => hotelsApi.details(hotelId, signal),
  });
  const search = useHotelSearch(request);
  const result = search.data?.hotels.find(({ hotel }) => hotel.id === hotelId);
  if (details.isPending) return <Skeleton className="h-72" />;
  if (details.error) return <RequestError error={details.error} />;
  const hotel = details.data;
  return (
    <div className="space-y-7">
      <PageHeading
        title={hotel.name}
        description={[hotel.address, hotel.city, hotel.countryCode].filter(Boolean).join(', ')}
      />
      <Card className="space-y-4">
        {hotel.starRating ? <p className="font-medium">{hotel.starRating}-star hotel</p> : null}
        <p className="text-muted-foreground">
          {hotel.description || 'Hotel information is provided by the connected supplier.'}
        </p>
        {hotel.facilities.length ? (
          <ul className="flex flex-wrap gap-2">
            {hotel.facilities.map((facility) => (
              <li key={facility} className="rounded-md bg-muted px-3 py-1 text-sm">
                {facility}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Rooms for your stay</h2>
        {!request ? (
          <Card className="space-y-4">
            <p>Choose dates and guests to see room availability.</p>
            <Button asChild>
              <Link href="/hotels">Search availability</Link>
            </Button>
          </Card>
        ) : null}
        {request && search.isPending ? <Skeleton className="h-40" /> : null}
        {search.error ? <RequestError error={search.error} /> : null}
        {result?.rates.map((rate) => (
          <Card key={rate.rateId} className="flex flex-col justify-between gap-5 sm:flex-row">
            <div className="space-y-2">
              <h3 className="font-semibold">{rate.roomName}</h3>
              <p className="text-sm text-muted-foreground">
                {rate.mealType ?? 'Meal details supplied at recheck'} ·{' '}
                {rate.refundable ? 'Refundable rate' : 'Non-refundable rate'}
              </p>
              <p className="text-sm">
                {request?.checkIn} → {request?.checkOut}
              </p>
            </div>
            <div className="space-y-3 sm:text-right">
              <p className="text-xl font-semibold">{formatMoney(rate.price)}</p>
              <p className="text-xs text-muted-foreground">
                Total for the stay · confirmed at checkout
              </p>
              <Button asChild>
                <Link href={`/checkout?rateId=${encodeURIComponent(rate.rateId)}`}>
                  Select room
                </Link>
              </Button>
            </div>
          </Card>
        ))}
        {search.data && !result?.rates.length ? (
          <Card>No rooms are available for these dates. Please try another search.</Card>
        ) : null}
      </section>
    </div>
  );
}
