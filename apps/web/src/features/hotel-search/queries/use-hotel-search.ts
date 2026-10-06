import type { HotelSearchRequest } from '@hotel/contracts';
import { useQuery } from '@tanstack/react-query';

import { hotelsApi } from '@/services/api/hotels.api';

export const hotelSearchKey = (request: HotelSearchRequest | null) =>
  ['hotel-search', request] as const;

export function useHotelSearch(request: HotelSearchRequest | null) {
  return useQuery({
    queryKey: hotelSearchKey(request),
    queryFn: ({ signal }) => {
      if (!request) throw new Error('Choose your destination and dates first.');
      return hotelsApi.search(request, signal);
    },
    enabled: request !== null,
    staleTime: 30_000,
  });
}
