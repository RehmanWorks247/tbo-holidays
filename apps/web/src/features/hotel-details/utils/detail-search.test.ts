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

  it('loads a selected mock hotel without adding a destination, dates or guests', () => {
    const request = hotelDetailsSearch(
      {
        currency: 'GBP',
        filters: { starRatings: [5], refundable: true },
        sort: 'stars',
        page: 3,
      },
      { id: 'hotel-1', name: 'Palm House', images: [], facilities: [], source: 'mock' },
    );
    expect(request).toEqual({
      currency: 'GBP',
      filters: { name: 'Palm House' },
      page: 1,
      pageSize: 50,
    });
    expect(request?.destination).toBeUndefined();
    expect(request?.checkIn).toBeUndefined();
    expect(request?.checkOut).toBeUndefined();
    expect(request?.rooms).toBeUndefined();
  });

  it('retains independently selected mock stay fields', () => {
    const request = hotelDetailsSearch(
      { currency: 'GBP', checkIn: '2030-06-10', rooms: [{ adults: 3, childrenAges: [] }] },
      { id: 'hotel-1', name: 'Palm House', images: [], facilities: [], source: 'mock' },
    );
    expect(request?.checkIn).toBe('2030-06-10');
    expect(request?.checkOut).toBeUndefined();
    expect(request?.rooms).toEqual([{ adults: 3, childrenAges: [] }]);
  });
});
