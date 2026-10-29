import {
  type HotelCatalogQuery,
  hotelCatalogResponseSchema,
  hotelDestinationsResponseSchema,
  hotelSchema,
  hotelSearchResponseSchema,
  hotelSearchSuggestionsResponseSchema,
  type MockHotelSearchRequest,
  quoteResponseSchema,
} from '@hotel/contracts';

import { serializeHotelSearch } from '@/features/hotel-search/utils/search-params';
import { apiRequest } from '@/services/api/api-client';

export const hotelsApi = {
  catalog: (request: HotelCatalogQuery, signal?: AbortSignal) =>
    apiRequest(
      `/hotels/catalog?${new URLSearchParams({
        query: request.query,
        page: String(request.page),
        pageSize: String(request.pageSize),
      })}`,
      hotelCatalogResponseSchema,
      { signal },
    ),
  destinations: (signal?: AbortSignal) =>
    apiRequest('/hotels/destinations', hotelDestinationsResponseSchema, { signal }),
  suggestions: (query: string, signal?: AbortSignal) =>
    apiRequest(
      `/hotels/suggestions?${new URLSearchParams({ query, limit: '10' })}`,
      hotelSearchSuggestionsResponseSchema,
      { signal },
    ),
  search: (request: MockHotelSearchRequest, signal?: AbortSignal) =>
    apiRequest(`/hotels/search?${serializeHotelSearch(request)}`, hotelSearchResponseSchema, {
      signal,
      timeoutMs: 120_000,
    }),
  details: (id: string, signal?: AbortSignal) =>
    apiRequest(`/hotels/${encodeURIComponent(id)}`, hotelSchema, { signal }),
  recheck: (rateId: string, token: string) =>
    apiRequest('/hotels/recheck', quoteResponseSchema, { method: 'POST', body: { rateId }, token }),
};
