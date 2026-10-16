import { useQuery } from '@tanstack/react-query';

import { hotelsApi } from '@/services/api/hotels.api';

export function useHotelDestinations() {
  return useQuery({
    queryKey: ['hotel-destinations'],
    queryFn: ({ signal }) => hotelsApi.destinations(signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
