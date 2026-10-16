import type { HotelSearchRequest } from '@hotel/contracts';
import { describe, expect, it } from 'vitest';

import {
  defaultMockSearch,
  parseHotelSearch,
  searchStayOnly,
  serializeHotelSearch,
} from './search-params';

const fullSearch: HotelSearchRequest = {
  destination: 'dubai',
  checkIn: '2030-06-10',
  checkOut: '2030-06-17',
  nationality: 'GB',
  currency: 'GBP',
  rooms: [
    { adults: 2, childrenAges: [0, 12] },
    { adults: 1, childrenAges: [] },
  ],
  filters: {
    name: 'Palm & Sea + Spa',
    minPrice: 10001,
    maxPrice: 150099,
    starRatings: [4, 5],
    minReviewScore: 8,
    facilities: ['Free WiFi', 'Swimming pool'],
    mealTypes: ['Breakfast included', 'All inclusive'],
    refundable: true,
    propertyTypes: ['Resort', 'Boutique hotel'],
    neighbourhoods: ['Jumeirah Beach', 'Café Quarter'],
    maxBeachDistance: 500,
  },
  sort: 'price-asc',
  page: 2,
  pageSize: 12,
};

describe('shareable search URLs', () => {
  it("round trips each room's occupancy without losing child ages", () => {
    const request: HotelSearchRequest = {
      destination: '123456',
      checkIn: '2030-06-10',
      checkOut: '2030-06-12',
      nationality: 'PK',
      currency: 'USD',
      rooms: [
        { adults: 2, childrenAges: [0, 12] },
        { adults: 1, childrenAges: [] },
      ],
    };
    expect(parseHotelSearch(new URLSearchParams(serializeHotelSearch(request)))).toEqual(request);
  });
  it('rejects malformed or incomplete URLs without crashing', () => {
    expect(parseHotelSearch(new URLSearchParams('rooms=not-json'))).toBeNull();
    expect(parseHotelSearch(new URLSearchParams('destination=123'))).toBeNull();
  });

  it('defaults valid search URLs without a currency parameter to USD', () => {
    const params = new URLSearchParams({
      destination: '123456',
      checkIn: '2030-06-10',
      checkOut: '2030-06-12',
      nationality: 'PK',
      rooms: JSON.stringify([{ adults: 2, childrenAges: [] }]),
    });

    expect(parseHotelSearch(params)?.currency).toBe('USD');
  });

  it('round trips all backend filters, sorting and pagination without losing encoded names or price cents', () => {
    const params = new URLSearchParams(serializeHotelSearch(fullSearch));
    expect(parseHotelSearch(params)).toEqual(fullSearch);
    expect(params.getAll('filters')).toHaveLength(1);
  });

  it('preserves zero-valued thresholds and an explicitly non-refundable selection', () => {
    const request: HotelSearchRequest = {
      ...fullSearch,
      filters: {
        minPrice: 0,
        maxPrice: 0,
        minReviewScore: 0,
        maxBeachDistance: 0,
        refundable: false,
      },
    };
    expect(parseHotelSearch(new URLSearchParams(serializeHotelSearch(request)))).toEqual(request);
  });

  it.each([
    ['filters', 'not-json'],
    ['filters', 'null'],
    ['filters', '[]'],
    ['filters', '{"unknownField":true}'],
    ['filters', '{"minPrice":200,"maxPrice":100}'],
    ['filters', '{"maxPrice":1.5}'],
    ['filters', '{"maxPrice":2000000001}'],
    ['filters', '{"starRatings":[6]}'],
    ['filters', '{"facilities":[null]}'],
    ['sort', 'random'],
    ['page', '0'],
    ['page', '1.5'],
    ['page', 'Infinity'],
    ['page', '2abc'],
    ['pageSize', '51'],
  ])('rejects unsafe search state in %s=%s', (key, value) => {
    const params = new URLSearchParams(serializeHotelSearch(fullSearch));
    params.set(key, value);
    expect(parseHotelSearch(params)).toBeNull();
  });

  it('starts a new stay without inheriting result filters or a stale page', () => {
    const original = structuredClone(fullSearch);
    expect(searchStayOnly(fullSearch)).toEqual({
      destination: fullSearch.destination,
      checkIn: fullSearch.checkIn,
      checkOut: fullSearch.checkOut,
      nationality: fullSearch.nationality,
      currency: fullSearch.currency,
      rooms: fullSearch.rooms,
    });
    expect(fullSearch).toEqual(original);
  });

  it('uses future UTC dates for the explicit mock default even across a year boundary', () => {
    const request = defaultMockSearch('AED', new Date('2030-12-31T23:45:00Z'));
    expect(request).toMatchObject({
      destination: 'dubai',
      checkIn: '2031-01-30',
      checkOut: '2031-02-06',
      currency: 'AED',
    });
    expect(parseHotelSearch(new URLSearchParams(serializeHotelSearch(request)))).toEqual(request);
  });
});
