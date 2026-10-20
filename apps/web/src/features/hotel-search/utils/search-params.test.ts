import type { HotelSearchRequest, MockHotelSearchRequest } from '@hotel/contracts';
import { describe, expect, it } from 'vitest';

import { parseHotelSearch, searchStayOnly, serializeHotelSearch } from './search-params';

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

  it('keeps an empty mock search empty without inventing dates, destination or guests', () => {
    const params = new URLSearchParams();
    const request = parseHotelSearch(params, 'mock', 'AED');
    expect(request).toEqual({ currency: 'AED' });
    expect(params.toString()).toBe('');
    expect(serializeHotelSearch(request!)).toBe('currency=AED');
    expect(parseHotelSearch(params)).toBeNull();
  });

  it('round trips partial mock searches and global filters without requiring a destination', () => {
    const request: MockHotelSearchRequest = {
      currency: 'GBP',
      filters: fullSearch.filters,
      sort: 'rating',
      page: 2,
      pageSize: 5,
    };
    const serialized = serializeHotelSearch(request);
    expect(parseHotelSearch(new URLSearchParams(serialized), 'mock')).toEqual(request);
    expect(parseHotelSearch(new URLSearchParams(serialized))).toBeNull();
    expect(serialized).not.toContain('destination=');
    expect(serialized).not.toContain('checkIn=');
    expect(parseHotelSearch(new URLSearchParams('destination=london'), 'mock')).toEqual({
      destination: 'london',
      currency: 'USD',
    });
    expect(searchStayOnly(request)).toEqual({ currency: 'GBP' });
  });

  it('treats empty mock scalar criteria as omitted while rejecting malformed supplied values', () => {
    expect(
      parseHotelSearch(new URLSearchParams('destination=&checkIn=&checkOut=&nationality='), 'mock'),
    ).toEqual({ currency: 'USD' });
    for (const query of [
      'checkIn=invalid',
      'checkIn=2030-06-10&checkOut=2030-06-09',
      'nationality=wrong',
      'rooms=[]',
      'rooms=not-json',
      'filters=not-json',
      'filters=%7B%22maxPrice%22%3A-1%7D',
      'sort=random',
      'page=0',
      'currency=XXX',
    ]) {
      expect(parseHotelSearch(new URLSearchParams(query), 'mock'), query).toBeNull();
    }
  });
});
