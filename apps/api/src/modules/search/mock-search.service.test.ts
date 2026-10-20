import { type HotelSearchRequest, hotelSearchResponseSchema } from '@hotel/contracts';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMockHotelDatabase } from '../../../test/mock-hotel-database.fixture';
import type { Environment } from '../../config/environment';
import { MockHotelSupplier } from '../hotels/mock-hotel.supplier';
import { MockSearchService } from './mock-search.service';
import { hotelSearchQuerySchema, mockHotelSearchQuerySchema } from './search.schemas';

const criteria: HotelSearchRequest = {
  destination: 'dubai',
  checkIn: '2100-11-01',
  checkOut: '2100-11-08',
  nationality: 'GB',
  rooms: [{ adults: 2, childrenAges: [] }],
  currency: 'GBP',
  pageSize: 50,
};

function setup(maximumNights = 30) {
  const config = new ConfigService<Environment, true>({
    HOTEL_DATA_MODE: 'mock',
    NODE_ENV: 'test',
    MAX_STAY_NIGHTS: maximumNights,
  });
  const supplier = new MockHotelSupplier(config, createMockHotelDatabase().database);
  return { supplier, service: new MockSearchService(supplier, config) };
}

describe('read-only hotel preview', () => {
  afterEach(() => vi.useRealTimers());

  it('browses every seeded hotel without criteria and declares the backend pricing stay', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-10-01T12:00:00Z'));
    const { service } = setup();
    const all = hotelSearchResponseSchema.parse(
      await service.searchHotels(mockHotelSearchQuerySchema.parse({})),
    );
    expect(all.hotels).toHaveLength(45);
    expect(new Set(all.hotels.map(({ hotel }) => hotel.id)).size).toBe(45);
    expect(new Set(all.hotels.map(({ hotel }) => hotel.city)).size).toBe(4);
    expect(all.metadata).toMatchObject({
      source: 'mock',
      destination: 'All destinations',
      total: 45,
      pageSize: 50,
      totalPages: 1,
      previewStay: {
        checkIn: '2099-10-31',
        checkOut: '2099-11-07',
        nationality: 'GB',
        currency: 'USD',
        rooms: [{ adults: 2, childrenAges: [] }],
      },
    });
    for (const destination of ['dubai', 'london', 'antalya', 'bali']) {
      const local = await service.searchHotels({
        ...all.metadata!.previewStay!,
        destination,
      });
      for (const result of local.hotels) {
        expect(all.hotels.find(({ hotel }) => hotel.id === result.hotel.id)).toEqual(result);
      }
    }
  });

  it('applies filters, facets, global ordering and pagination across all destinations', async () => {
    const { service } = setup();
    const input = mockHotelSearchQuerySchema.parse({
      filters: JSON.stringify({ starRatings: [1, 2] }),
      sort: 'price-asc',
    });
    const filtered = await service.searchHotels(input);
    expect(filtered.hotels.length).toBeGreaterThan(4);
    expect(filtered.hotels.length).toBeLessThan(45);
    expect(new Set(filtered.hotels.map(({ hotel }) => hotel.city)).size).toBe(4);
    expect(filtered.hotels.every(({ hotel }) => [1, 2].includes(hotel.starRating!))).toBe(true);
    const totals = filtered.hotels.map(({ rates }) => rates[0]!.price.totalAmount);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
    const first = await service.searchHotels({ ...input, pageSize: 4, page: 1 });
    const second = await service.searchHotels({ ...input, pageSize: 4, page: 2 });
    expect([...first.hotels, ...second.hotels].map(({ hotel }) => hotel.id)).toEqual(
      filtered.hotels.slice(0, 8).map(({ hotel }) => hotel.id),
    );
    expect(first.metadata).toMatchObject({
      total: filtered.hotels.length,
      pageSize: 4,
      totalPages: Math.ceil(filtered.hotels.length / 4),
    });
    const all = await service.searchHotels({ currency: 'USD' });
    expect(first.metadata?.facets).toEqual(all.metadata?.facets);
    expect(first.metadata?.facets.starRatings.reduce((sum, facet) => sum + facet.count, 0)).toBe(
      45,
    );
  });

  it('accepts location alone and honors explicit partial stay, occupancy and currency inputs', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-10-01T12:00:00Z'));
    const { service } = setup();
    const location = await service.searchHotels({ destination: 'london', currency: 'USD' });
    expect(location.hotels.length).toBeGreaterThan(0);
    expect(location.hotels.every(({ hotel }) => hotel.city === 'London')).toBe(true);
    const arrival = await service.searchHotels({
      checkIn: '2100-01-15',
      nationality: 'PK',
      currency: 'GBP',
      rooms: [{ adults: 3, childrenAges: [8] }],
    });
    expect(arrival.metadata?.previewStay).toEqual({
      checkIn: '2100-01-15',
      checkOut: '2100-01-22',
      nationality: 'PK',
      currency: 'GBP',
      rooms: [{ adults: 3, childrenAges: [8] }],
    });
    expect(arrival.hotels.every(({ hotel }) => !hotel.facilities.includes('Adults only'))).toBe(
      true,
    );
    const departure = await service.searchHotels({ checkOut: '2100-01-15', currency: 'USD' });
    expect(departure.metadata?.previewStay).toMatchObject({
      checkIn: '2100-01-08',
      checkOut: '2100-01-15',
    });
    const nearDeparture = await service.searchHotels({ checkOut: '2099-10-03', currency: 'USD' });
    expect(nearDeparture.metadata?.previewStay).toMatchObject({
      checkIn: '2099-10-01',
      checkOut: '2099-10-03',
    });
  });

  it('bounds omitted dates by configured stay limits and rejects explicit invalid stays', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-10-01T12:00:00Z'));
    const { service } = setup(3);
    expect((await service.searchHotels({ currency: 'USD' })).metadata?.previewStay).toMatchObject({
      checkIn: '2099-10-31',
      checkOut: '2099-11-03',
    });
    for (const stay of [
      { checkIn: '2099-09-30' },
      { checkOut: '2099-10-01' },
      { checkIn: '2100-01-08', checkOut: '2100-01-07' },
      { checkIn: '2100-01-01', checkOut: '2100-01-05' },
    ]) {
      await expect(service.searchHotels({ ...stay, currency: 'USD' })).rejects.toMatchObject({
        code: 'INVALID_STAY',
      });
    }
  });
  it('requires explicit non-production mode', () => {
    for (const values of [
      { HOTEL_DATA_MODE: 'live', NODE_ENV: 'test' },
      { HOTEL_DATA_MODE: 'mock', NODE_ENV: 'production' },
    ]) {
      expect(
        () => new MockHotelSupplier(new ConfigService(values), createMockHotelDatabase().database),
      ).toThrow('non-production');
    }
  });

  it('reports missing seed data or database failures without falling back to fixtures', async () => {
    const fixture = createMockHotelDatabase();
    const supplier = new MockHotelSupplier(
      new ConfigService<Environment, true>({
        HOTEL_DATA_MODE: 'mock',
        NODE_ENV: 'test',
        MAX_STAY_NIGHTS: 30,
      }),
      fixture.database,
    );
    fixture.mockDestination.findMany.mockResolvedValue([]);
    fixture.mockDestination.findFirst.mockResolvedValue(null);
    fixture.mockDestination.count.mockResolvedValue(0);
    await expect(supplier.getDestinations()).rejects.toMatchObject({
      code: 'MOCK_INVENTORY_NOT_SEEDED',
    });
    await expect(supplier.searchHotels(criteria)).rejects.toMatchObject({
      code: 'MOCK_INVENTORY_NOT_SEEDED',
    });
    fixture.mockDestination.findMany.mockRejectedValue(new Error('private connection value'));
    await expect(supplier.getDestinations()).rejects.toMatchObject({
      code: 'MOCK_INVENTORY_UNAVAILABLE',
    });
  });

  it('returns realistic marked inventory that validates through the public API schema', async () => {
    const { service } = setup();
    const result = hotelSearchResponseSchema.parse(await service.searchHotels(criteria));
    expect(result.metadata).toMatchObject({
      source: 'mock',
      total: 26,
      destination: 'Dubai',
      page: 1,
      totalPages: 1,
    });
    expect(
      result.hotels.every(
        ({ hotel, rates }) =>
          hotel.source === 'mock' &&
          rates.every((rate) => rate.rateId.startsWith('mock:') && rate.price.currency === 'GBP'),
      ),
    ).toBe(true);
    expect(new Set(result.hotels.map(({ hotel }) => hotel.id)).size).toBe(26);
    expect(result.metadata?.facets.minPrice).toBeGreaterThan(10000);
    expect(result.metadata?.facets.maxPrice).toBeGreaterThan(result.metadata?.facets.minPrice ?? 0);
  });

  it('returns deterministic prices and changes totals for stay length, occupancy and currency', async () => {
    const { service } = setup();
    const original = await service.searchHotels(criteria);
    const repeat = await service.searchHotels(criteria);
    expect(original.hotels.map(({ rates }) => rates.map(({ price }) => price))).toEqual(
      repeat.hotels.map(({ rates }) => rates.map(({ price }) => price)),
    );
    const firstPrice = original.hotels[0]!.rates[0]!.price.totalAmount;
    const longer = await service.searchHotels({ ...criteria, checkOut: '2100-11-15' });
    const rooms = await service.searchHotels({
      ...criteria,
      rooms: [...criteria.rooms, ...criteria.rooms],
    });
    const usd = await service.searchHotels({ ...criteria, currency: 'USD' });
    expect(longer.hotels[0]!.rates[0]!.price.totalAmount).toBeGreaterThan(firstPrice);
    expect(rooms.hotels[0]!.rates[0]!.price.totalAmount).toBeGreaterThan(firstPrice);
    expect(usd.hotels[0]!.rates[0]!.price.totalAmount).not.toBe(firstPrice);
    expect(rooms.hotels[0]!.rates[0]!.terms?.roomNames).toHaveLength(2);
  });

  it('combines hotel categories and filters actual rates by meals, refunds and total budget', async () => {
    const { service } = setup();
    const all = await service.searchHotels(criteria);
    const result = await service.searchHotels({
      ...criteria,
      filters: {
        starRatings: [5],
        minReviewScore: 9,
        facilities: ['Swimming pool', 'Spa'],
        propertyTypes: ['Resort'],
        neighbourhoods: ['Palm Jumeirah', 'Jumeirah Beach'],
        maxBeachDistance: 200,
        refundable: true,
        mealTypes: ['Breakfast included'],
        maxPrice: 300000,
      },
    });
    expect(result.hotels.length).toBeGreaterThan(0);
    expect(result.hotels.length).toBeLessThan(all.hotels.length);
    for (const { hotel, rates } of result.hotels) {
      expect(hotel.starRating).toBe(5);
      expect(hotel.propertyType).toBe('Resort');
      expect(hotel.reviewScore).toBeGreaterThanOrEqual(9);
      expect(hotel.beachDistanceMeters).toBeLessThanOrEqual(200);
      expect(rates).toHaveLength(1);
      expect(rates[0]).toMatchObject({ mealType: 'Breakfast included', refundable: true });
      expect(rates[0]!.price.totalAmount).toBeLessThanOrEqual(300000);
    }
    expect(result.metadata?.facets).toEqual(all.metadata?.facets);
  });

  it('filters by case-insensitive hotel name and exact min/max price', async () => {
    const { service } = setup();
    const original = await service.searchHotels({ ...criteria, filters: { name: 'pALm aZuRe' } });
    expect(original.hotels).toHaveLength(1);
    const price = original.hotels[0]!.rates[0]!.price.totalAmount;
    const exact = await service.searchHotels({
      ...criteria,
      filters: { name: 'Palm Azure', minPrice: price, maxPrice: price },
    });
    expect(exact.hotels[0]?.rates).toHaveLength(1);
    expect(
      (await service.searchHotels({ ...criteria, filters: { maxPrice: 1 } })).metadata?.total,
    ).toBe(0);
  });

  it('preserves typed name spaces in query parsing while trimming them for backend matching', async () => {
    const { service } = setup();
    const parsed = hotelSearchQuerySchema.parse({
      ...criteria,
      rooms: JSON.stringify(criteria.rooms),
      filters: JSON.stringify({ name: ' Palm Azure ' }),
    });
    expect(parsed.filters?.name).toBe(' Palm Azure ');
    const result = await service.searchHotels(parsed);
    expect(result.hotels).toHaveLength(1);
    expect(result.hotels[0]?.hotel.name).toBe('The Palm Azure Resort');
    const whitespace = await service.searchHotels({ ...criteria, filters: { name: '   ' } });
    expect(whitespace.metadata?.total).toBe(26);
  });

  it('sorts all inventory before pagination and uses stable page boundaries', async () => {
    const { service } = setup();
    const all = await service.searchHotels({ ...criteria, sort: 'price-asc' });
    const totals = all.hotels.map(({ rates }) => rates[0]!.price.totalAmount);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
    const page1 = await service.searchHotels({
      ...criteria,
      sort: 'price-asc',
      page: 1,
      pageSize: 5,
    });
    const page2 = await service.searchHotels({
      ...criteria,
      sort: 'price-asc',
      page: 2,
      pageSize: 5,
    });
    expect(page1.metadata).toMatchObject({ total: 26, totalPages: 6, page: 1, pageSize: 5 });
    expect([...page1.hotels, ...page2.hotels].map(({ hotel }) => hotel.id)).toEqual(
      all.hotels.slice(0, 10).map(({ hotel }) => hotel.id),
    );
    expect(
      (await service.searchHotels({ ...criteria, sort: 'rating' })).hotels[0]?.hotel.reviewScore,
    ).toBe(9.7);
    expect(
      (await service.searchHotels({ ...criteria, sort: 'price-desc' })).hotels[0]?.hotel.id,
    ).toBe(all.hotels.at(-1)?.hotel.id);
  });

  it('excludes adults-only properties for child occupancy and never offers contradictory facilities', async () => {
    const { service } = setup();
    const result = await service.searchHotels({
      ...criteria,
      rooms: [{ adults: 2, childrenAges: [8] }],
    });
    expect(result.hotels.length).toBeLessThan(26);
    expect(result.hotels.every(({ hotel }) => !hotel.facilities.includes('Adults only'))).toBe(
      true,
    );
  });

  it('does not claim free cancellation after the sample penalty window starts', async () => {
    const { service } = setup();
    const checkIn = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const checkOut = new Date(Date.now() + 8 * 86_400_000).toISOString().slice(0, 10);
    const result = await service.searchHotels({ ...criteria, checkIn, checkOut });
    expect(result.hotels.length).toBeGreaterThan(0);
    expect(result.hotels.every(({ rates }) => rates.every(({ refundable }) => !refundable))).toBe(
      true,
    );
    const refundable = await service.searchHotels({
      ...criteria,
      checkIn,
      checkOut,
      filters: { refundable: true },
    });
    expect(refundable.metadata?.total).toBe(0);
  });

  it('has independent inventory for every destination and returns empty unknown destinations', async () => {
    const { service, supplier } = setup();
    for (const { id, name } of (await supplier.getDestinations()).destinations) {
      const result = await service.searchHotels({ ...criteria, destination: id });
      expect(result.hotels.length).toBeGreaterThanOrEqual(6);
      expect(result.hotels.every(({ hotel }) => hotel.city === name)).toBe(true);
    }
    const empty = await service.searchHotels({ ...criteria, destination: 'unknown' });
    expect(empty.hotels).toEqual([]);
    expect(empty.metadata).toMatchObject({ total: 0, totalPages: 0 });
  });

  it.each(['dubai', 'london', 'antalya', 'bali'])(
    'has matching inventory for every star tier and narrowing guest-rating filters in %s',
    async (destination) => {
      const { service } = setup();
      const request = { ...criteria, destination };
      const all = await service.searchHotels(request);
      for (const starRating of [1, 2, 3, 4, 5]) {
        const filtered = await service.searchHotels({
          ...request,
          filters: { starRatings: [starRating] },
        });
        expect(filtered.hotels.length).toBeGreaterThan(0);
        expect(filtered.hotels.length).toBeLessThan(all.hotels.length);
        expect(filtered.hotels.every(({ hotel }) => hotel.starRating === starRating)).toBe(true);
        expect(
          all.metadata?.facets.starRatings.find(({ value }) => value === starRating)?.count,
        ).toBe(filtered.hotels.length);
      }
      let previousCount = all.hotels.length;
      for (const minReviewScore of [7, 8, 9]) {
        const filtered = await service.searchHotels({
          ...request,
          filters: { minReviewScore },
        });
        expect(filtered.hotels.length).toBeGreaterThan(0);
        expect(filtered.hotels.length).toBeLessThan(previousCount);
        expect(
          filtered.hotels.every(({ hotel }) => (hotel.reviewScore ?? 0) >= minReviewScore),
        ).toBe(true);
        previousCount = filtered.hotels.length;
      }
    },
  );

  it('returns independent detail objects and rejects nonexistent properties', async () => {
    const { supplier } = setup();
    const first = await supplier.getHotelDetails('mock-dubai-01');
    first.facilities.push('mutated');
    expect((await supplier.getHotelDetails('mock-dubai-01')).facilities).not.toContain('mutated');
    await expect(supplier.getHotelDetails('unknown')).rejects.toMatchObject({
      code: 'HOTEL_NOT_FOUND',
    });
  });

  it('rejects every supplier mutation and any preview quote without persistence', async () => {
    const { service, supplier } = setup();
    for (const action of [
      () => supplier.createBooking(),
      () => supplier.cancelBooking(),
      () => supplier.getBooking(),
      () => supplier.recheckPrice(),
      () => service.recheckHotelRate(),
    ]) {
      await expect(action()).rejects.toMatchObject({ code: 'MOCK_BOOKING_DISABLED' });
    }
  });

  it('validates query JSON, bounds and strict filter fields without accepting browser totals', () => {
    const input = {
      ...criteria,
      rooms: JSON.stringify(criteria.rooms),
      page: '2',
      pageSize: '5',
      filters: JSON.stringify({ starRatings: [4, 5], refundable: false }),
    };
    expect(hotelSearchQuerySchema.parse(input)).toMatchObject({
      page: 2,
      pageSize: 5,
      filters: { starRatings: [4, 5], refundable: false },
    });
    for (const invalid of [
      { filters: '{' },
      { pageSize: '1000' },
      { page: '-1' },
      { filters: JSON.stringify({ minPrice: 200, maxPrice: 100 }) },
      { filters: JSON.stringify({ totalAmount: 1 }) },
      { totalAmount: '1' },
    ]) {
      expect(hotelSearchQuerySchema.safeParse({ ...input, ...invalid }).success).toBe(false);
    }
  });
});
