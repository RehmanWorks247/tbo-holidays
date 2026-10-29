'use client';

import type { MockHotelSearchRequest } from '@hotel/contracts';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, SearchX } from 'lucide-react';
import { useRef } from 'react';

import { RequestError } from '@/components/shared/request-error';
import { Skeleton } from '@/components/ui/skeleton';
import { serializeHotelSearch } from '@/features/hotel-search/utils/search-params';
import { hotelsApi } from '@/services/api/hotels.api';

import { HotelCard } from './hotel-card';
import styles from './hotel-results.module.css';

export function HotelCatalog({ search }: { search: MockHotelSearchRequest }) {
  const resultsRef = useRef<HTMLElement>(null);
  const request = {
    query: search.hotelId ?? search.destination ?? '',
    page: search.page ?? 1,
    pageSize: search.pageSize ?? 20,
  };
  const allHotels = request.query.trim().length === 0;
  const loadingMessage = allHotels
    ? 'Loading all hotels available in the TBO catalogue across countries and cities.'
    : 'Loading more matching hotels from TBO.';
  const catalog = useQuery({
    queryKey: ['hotel-catalog', request],
    queryFn: ({ signal }) => hotelsApi.catalog(request, signal),
    staleTime: 30_000,
    retry: false,
    refetchInterval: (query) => (!query.state.error && query.state.data?.syncing ? 2_500 : false),
  });
  const data = catalog.data;

  function changePage(page: number) {
    window.history.pushState(null, '', `/hotels?${serializeHotelSearch({ ...search, page })}`);
    resultsRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }

  return (
    <section ref={resultsRef} className={styles.resultsArea} lang="en" aria-label="Hotel catalogue">
      <div className={styles.resultsHeading}>
        <h1>{allHotels ? 'All hotels' : 'Explore hotels'}</h1>
      </div>
      <div className={styles.resultsContext}>
        <p>
          {allHotels
            ? 'Browse hotels across all countries and cities in the TBO catalogue.'
            : 'Browse real hotel details.'}{' '}
          Choose dates and guests above to check room availability and prices.
        </p>
      </div>
      <p className={styles.catalogStatus} role="status" aria-live="polite">
        {data
          ? `${new Intl.NumberFormat('en').format(data.total)} hotels${data.syncing ? (catalog.error ? ' loaded before loading was interrupted.' : ` loaded so far. ${loadingMessage}`) : ' found'}`
          : catalog.isPending
            ? loadingMessage
            : ''}
      </p>
      {catalog.error ? (
        <div className={styles.error}>
          <RequestError error={catalog.error} />
          <button type="button" onClick={() => void catalog.refetch()}>
            Try again
          </button>
        </div>
      ) : null}
      {catalog.isPending || (data?.syncing && !data.hotels.length && !catalog.error) ? (
        <div className={styles.skeletons} aria-label="Loading hotel catalogue" role="status">
          {[1, 2, 3].map((id) => (
            <Skeleton key={id} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : null}
      {data ? (
        <div className={styles.hotelList} aria-busy={catalog.isFetching}>
          {data.hotels.map((hotel, index) => (
            <HotelCard
              key={hotel.id}
              result={{ hotel, rates: [] }}
              search={search}
              priority={index === 0}
            />
          ))}
          {!data.syncing && !data.hotels.length ? (
            <div className={styles.empty}>
              <SearchX size={42} aria-hidden="true" />
              <h2>No hotels match this search</h2>
              <p>Try another country, city or hotel name.</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {data && data.totalPages > 1 ? (
        <nav className={styles.pagination} aria-label="Hotel catalogue pages">
          <button
            type="button"
            disabled={data.page <= 1 || catalog.isFetching}
            onClick={() => changePage(data.page - 1)}
            aria-label="Previous page"
          >
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <button
            type="button"
            disabled={data.page >= data.totalPages || catalog.isFetching}
            onClick={() => changePage(data.page + 1)}
            aria-label="Next page"
          >
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </nav>
      ) : null}
    </section>
  );
}
