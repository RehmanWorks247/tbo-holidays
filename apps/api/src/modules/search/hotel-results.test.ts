import type {
  HotelRate,
  HotelResultsFilters,
  HotelSearchRequest,
  HotelSearchResult,
} from '@hotel/contracts';
import { describe, expect, it } from 'vitest';

import { browseHotelResults } from './hotel-results';

function offer(rateId: string, amount: number, mealType: string, refundable: boolean): HotelRate {
  return {
    rateId,
    roomName: 'Double',
    mealType,
    refundable,
    price: {
      currency: 'GBP',
      baseAmount: amount - 100,
      taxAmount: 100,
      feeAmount: 0,
      markupAmount: 0,
      discountAmount: 0,
      totalAmount: amount,
    },
    expiresAt: '2100-01-01T00:00:00Z',
  };
}

const inventory: HotelSearchResult[] = [
  {
    hotel: {
      id: '200',
      name: 'Seafront Hotel',
      images: [],
      facilities: ['Free WiFi', 'Pool', 'Pool'],
      starRating: 5,
      reviewScore: 8.5,
      propertyType: 'Hotel',
      neighbourhood: 'Marina',
      beachDistanceMeters: 100,
    },
    rates: [
      offer('breakfast', 12000, 'BreakFast', true),
      offer('room-only', 8000, 'Room_Only', false),
    ],
  },
  {
    hotel: {
      id: '100',
      name: 'Central Apartments',
      images: [],
      facilities: ['Free WiFi', 'Kitchen'],
      starRating: 3,
      reviewScore: 9,
      propertyType: 'Apartment',
      neighbourhood: 'Centre',
      beachDistanceMeters: 1500,
    },
    rates: [offer('central', 10000, 'Room_Only', true)],
  },
  {
    hotel: { id: '300', name: 'Undocumented Hotel', images: [], facilities: [] },
    rates: [offer('unknown', 8000, 'Room_Only', false)],
  },
  {
    hotel: { id: '400', name: 'Unavailable Hotel', images: [], facilities: ['Invented amenity'] },
    rates: [],
  },
];

describe('live inventory filtering', () => {
  it.each<{ filters: HotelResultsFilters; ids: string[] }>([
    { filters: { name: ' sEaFrOnT ' }, ids: ['200'] },
    { filters: { minPrice: 10000, maxPrice: 10000 }, ids: ['100'] },
    { filters: { starRatings: [3, 4] }, ids: ['100'] },
    { filters: { minReviewScore: 9 }, ids: ['100'] },
    { filters: { minReviewScore: 0 }, ids: ['200', '100'] },
    { filters: { facilities: ['Pool', 'Free WiFi'] }, ids: ['200'] },
    { filters: { facilities: ['Pool', 'Kitchen'] }, ids: [] },
    { filters: { mealTypes: ['BreakFast'] }, ids: ['200'] },
    { filters: { refundable: true }, ids: ['200', '100'] },
    { filters: { refundable: false }, ids: ['200', '300'] },
    { filters: { propertyTypes: ['Apartment'] }, ids: ['100'] },
    { filters: { neighbourhoods: ['Marina'] }, ids: ['200'] },
    { filters: { maxBeachDistance: 100 }, ids: ['200'] },
    { filters: { maxBeachDistance: 99 }, ids: [] },
  ])('uses actual supplied attributes for $filters', ({ filters, ids }) => {
    const result = browseHotelResults(inventory, { filters }, 'live', 'City');
    expect(result.hotels.map(({ hotel }) => hotel.id)).toEqual(ids);
    expect(result.metadata?.total).toBe(ids.length);
  });

  it('requires meal, refundability and budget to match the same bookable rate', () => {
    const breakfast = browseHotelResults(
      inventory,
      { filters: { mealTypes: ['BreakFast'], refundable: true } },
      'live',
      'City',
    );
    expect(breakfast.hotels[0]?.rates.map(({ rateId }) => rateId)).toEqual(['breakfast']);
    expect(breakfast.hotels[0]?.rates[0]?.price.totalAmount).toBe(12000);
    const incompatible = browseHotelResults(
      inventory,
      { filters: { mealTypes: ['BreakFast'], refundable: true, maxPrice: 10000 } },
      'live',
      'City',
    );
    expect(incompatible.hotels).toEqual([]);
  });

  it('sorts by the cheapest matching rate before pagination with deterministic ties', () => {
    const first = browseHotelResults(
      inventory,
      { sort: 'price-asc', pageSize: 1, page: 1 },
      'live',
      'City',
    );
    const second = browseHotelResults(
      inventory,
      { sort: 'price-asc', pageSize: 1, page: 2 },
      'live',
      'City',
    );
    expect(first.hotels[0]?.hotel.id).toBe('200');
    expect(second.hotels[0]?.hotel.id).toBe('300');
    const refundable = browseHotelResults(
      inventory,
      { filters: { refundable: true }, sort: 'price-asc' },
      'live',
      'City',
    );
    expect(refundable.hotels.map(({ hotel }) => hotel.id)).toEqual(['100', '200']);
    expect(first.metadata).toMatchObject({ total: 3, totalPages: 3 });
    expect(
      browseHotelResults(inventory, { sort: 'rating' }, 'live', 'City').hotels[0]?.hotel.id,
    ).toBe('100');
    expect(
      browseHotelResults(inventory, { sort: 'stars' }, 'live', 'City').hotels[0]?.hotel.id,
    ).toBe('200');
  });

  it('derives facets from available unfiltered inventory without inventing content or mutating rates', () => {
    const original = structuredClone(inventory);
    const result = browseHotelResults(inventory, { filters: { name: 'Absent' } }, 'live', 'City');
    expect(result.hotels).toEqual([]);
    expect(result.metadata?.facets).toMatchObject({
      minPrice: 8000,
      maxPrice: 12000,
      starRatings: [
        { value: 5, count: 1 },
        { value: 3, count: 1 },
      ],
      facilities: [
        { value: 'Free WiFi', count: 2 },
        { value: 'Kitchen', count: 1 },
        { value: 'Pool', count: 1 },
      ],
      refundableCount: 2,
    });
    expect(inventory).toEqual(original);
  });
});

describe('large destination browsing', () => {
  it('calculates budgets and paginates large rate inventories without spreading function arguments', () => {
    const input: HotelSearchRequest = {
      destination: '100',
      checkIn: '2100-01-01',
      checkOut: '2100-01-08',
      nationality: 'GB',
      currency: 'GBP',
      rooms: [{ adults: 2, childrenAges: [] }],
      pageSize: 2,
      sort: 'price-asc',
    };
    const rates: HotelRate[] = Array.from({ length: 100 }, (_, index) => ({
      rateId: `rate-${index}`,
      roomName: 'Double',
      refundable: false,
      price: {
        currency: 'GBP',
        baseAmount: 10000 + index,
        taxAmount: 0,
        feeAmount: 0,
        markupAmount: 0,
        discountAmount: 0,
        totalAmount: 10000 + index,
      },
      expiresAt: '2100-01-01T00:00:00Z',
    }));
    const inventory: HotelSearchResult[] = Array.from({ length: 1500 }, (_, index) => ({
      hotel: {
        id: String(index).padStart(4, '0'),
        name: `Hotel ${index}`,
        images: [],
        facilities: ['Free WiFi'],
      },
      rates,
    }));
    const result = browseHotelResults(inventory, input, 'live', 'Large city');
    expect(result.hotels).toHaveLength(2);
    expect(result.metadata).toMatchObject({
      total: 1500,
      totalPages: 750,
      facets: {
        minPrice: 10000,
        maxPrice: 10099,
        facilities: [{ value: 'Free WiFi', count: 1500 }],
      },
    });
  });
});
