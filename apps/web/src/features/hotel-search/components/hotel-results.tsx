'use client';

import type { HotelFilters as Filters } from '@hotel/contracts';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { RequestError } from '@/components/shared/request-error';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { HotelCard } from '@/features/hotel-search/components/hotel-card';
import { HotelFilters } from '@/features/hotel-search/components/hotel-filters';
import { HotelSearchForm } from '@/features/hotel-search/components/hotel-search-form';
import { useHotelSearch } from '@/features/hotel-search/queries/use-hotel-search';
import { filterHotels } from '@/features/hotel-search/utils/filter-hotels';
import { parseHotelSearch } from '@/features/hotel-search/utils/search-params';

export function HotelResults() {
  const params = useSearchParams();
  const request = parseHotelSearch(params);
  const search = useHotelSearch(request);
  const [filters, setFilters] = useState<Filters>({});
  const hotels = filterHotels(search.data?.hotels ?? [], filters);
  return (
    <div className="space-y-7">
      <HotelSearchForm key={params.toString()} initialSearch={request} />
      {!request ? (
        <Card>Choose a destination, dates, and guests to see available hotels.</Card>
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-[230px_1fr]">
          <HotelFilters value={filters} onChange={setFilters} />
          <div className="space-y-4" aria-live="polite">
            {search.isPending ? (
              <>
                <Skeleton className="h-44" />
                <Skeleton className="h-44" />
                <p className="text-sm text-muted-foreground">Checking availability…</p>
              </>
            ) : null}
            {search.error ? <RequestError error={search.error} /> : null}
            {search.data ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {hotels.length} hotels · {request.checkIn} to {request.checkOut}
                </p>
                {hotels.length ? (
                  hotels.map((result) => (
                    <HotelCard key={result.hotel.id} result={result} search={request} />
                  ))
                ) : (
                  <Card>No hotels match this search. Try different dates or filters.</Card>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
