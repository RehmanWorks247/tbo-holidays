import type { HotelSearchRequest } from '@hotel/contracts';
import { describe, expect, it } from 'vitest';

import { hotelDetailsSearch } from './detail-search';

describe('hotel detail availability', () => {
  it('preserves the stay and occupancy while removing list filters and pagination', () => {
    const request: HotelSearchRequest = {
      destination: 'dubai',
      checkIn: '2030-06-10',
      checkOut: '2030-06-17',
      nationality: 'GB',
      currency: 'GBP',
      rooms: [{ adults: 2, childrenAges: [7] }],
      filters: { maxPrice: 50000, refundable: true, facilities: ['Pool'] },
      page: 4,
      pageSize: 12,
      sort: 'price-desc',
    };
    expect(
      hotelDetailsSearch(request, {
        id: 'hotel-1',
        name: 'Palm House',
        images: [],
        facilities: [],
      }),
    ).toEqual({
      destination: request.destination,
      checkIn: request.checkIn,
      checkOut: request.checkOut,
      nationality: request.nationality,
      currency: request.currency,
      rooms: request.rooms,
      filters: { name: 'Palm House' },
      page: 1,
      pageSize: 50,
    });
    expect(request.page).toBe(4);
  });

  it('does not request broad inventory while hotel details are still loading', () => {
    expect(hotelDetailsSearch(null, undefined)).toBeNull();
  });
});
