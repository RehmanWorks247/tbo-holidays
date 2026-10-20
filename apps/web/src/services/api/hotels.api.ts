import {
  hotelDestinationsResponseSchema,
  hotelSchema,
  hotelSearchResponseSchema,
  type MockHotelSearchRequest,
  quoteResponseSchema,
} from '@hotel/contracts';

import { serializeHotelSearch } from '@/features/hotel-search/utils/search-params';
import { apiRequest } from '@/services/api/api-client';

export const hotelsApi = {
  destinations: (signal?: AbortSignal) =>
    apiRequest('/hotels/destinations', hotelDestinationsResponseSchema, { signal }),
  search: (request: MockHotelSearchRequest, signal?: AbortSignal) =>
    apiRequest(`/hotels/search?${serializeHotelSearch(request)}`, hotelSearchResponseSchema, {
      signal,
    }),
  details: (id: string, signal?: AbortSignal) =>
    apiRequest(`/hotels/${encodeURIComponent(id)}`, hotelSchema, { signal }),
  recheck: (rateId: string, token: string) =>
    apiRequest('/hotels/recheck', quoteResponseSchema, { method: 'POST', body: { rateId }, token }),
};
