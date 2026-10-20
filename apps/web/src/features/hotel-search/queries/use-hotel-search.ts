import type { MockHotelSearchRequest } from '@hotel/contracts';
import { useQuery } from '@tanstack/react-query';

import { searchStayOnly } from '@/features/hotel-search/utils/search-params';
import { hotelsApi } from '@/services/api/hotels.api';

export const hotelSearchKey = (request: MockHotelSearchRequest | null) =>
  ['hotel-search', request] as const;

export function useHotelSearch(request: MockHotelSearchRequest | null) {
  return useQuery({
    queryKey: hotelSearchKey(request),
    queryFn: ({ signal }) => {
      if (!request) throw new Error('Choose your destination and dates first.');
      return hotelsApi.search(request, signal);
    },
    enabled: request !== null,
    staleTime: 30_000,
    // Keep the previous cards in place while a new filter request is in flight.
    // Destination/date/occupancy changes intentionally get a fresh loading state.
    placeholderData: (previous, previousQuery) => {
      const old = previousQuery?.queryKey[1];
      if (!old || typeof old !== 'object' || !request) return undefined;
      const criteria = searchStayOnly(old as MockHotelSearchRequest);
      const nextCriteria = searchStayOnly(request);
      return JSON.stringify(criteria) === JSON.stringify(nextCriteria) ? previous : undefined;
    },
  });
}
