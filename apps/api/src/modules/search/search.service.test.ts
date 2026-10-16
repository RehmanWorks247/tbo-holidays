import { type HotelSearchRequest, quoteResponseSchema } from '@hotel/contracts';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Environment } from '../../config/environment';
import type { RedisService } from '../../infrastructure/redis/redis.service';
import type { HotelSupplier, SupplierRate } from '../hotels/hotel-supplier';
import type { PricingService } from '../pricing/pricing.service';
import { hotelSearchQuerySchema } from './search.schemas';
import { SearchService } from './search.service';

const criteria: HotelSearchRequest = {
  destination: '100',
  checkIn: '2100-01-01',
  checkOut: '2100-01-03',
  nationality: 'PK',
  currency: 'USD',
  rooms: [{ adults: 2, childrenAges: [] }],
};
const hotel = { id: '123', name: 'Test fixture hotel', images: [], facilities: [] };
const rate: SupplierRate = {
  hotelId: hotel.id,
  supplierRateId: 'private-supplier-reference',
  roomName: 'Double',
  mealType: 'Room_Only',
  refundable: false,
  price: { currency: 'USD', baseAmount: 10000, taxAmount: 1000, feeAmount: 0 },
  cancellationPolicies: [],
  terms: {
    roomNames: ['Double'],
    amenities: ['Wi-Fi'],
    promotions: [],
    rateConditions: ['Photo identification required at check-in.'],
    supplements: [
      {
        payment: 'at-property',
        description: 'City fee',
        amount: 2000,
        currency: 'AED',
        roomIndex: 0,
      },
    ],
  },
};
const price = { ...rate.price, markupAmount: 1000, discountAmount: 0, totalAmount: 12000 };

function setup() {
  const set = vi.fn();
  const get = vi.fn();
  const saveInventory = vi.fn().mockResolvedValue('OK');
  const exec = vi.fn().mockResolvedValue([[null, 'OK']]);
  const redis = {
    client: { get, set: saveInventory, pipeline: () => ({ set, exec }) },
  } as unknown as RedisService;
  const recheckPrice = vi.fn().mockResolvedValue(rate);
  const supplier = {
    name: 'TBO',
    searchHotels: vi.fn().mockResolvedValue([{ hotel, rates: [rate] }]),
    recheckPrice,
  } as unknown as HotelSupplier;
  const createQuote = vi.fn().mockResolvedValue({
    id: 'a3bcf14e-6f75-4cc1-90c2-9c91bf225def',
    expiresAt: new Date('2100-01-01'),
  });
  const pricing = { calculateBookingTotal: () => price, createQuote } as unknown as PricingService;
  const service = new SearchService(
    supplier,
    pricing,
    redis,
    new ConfigService<Environment, true>({ MAX_STAY_NIGHTS: 30 }),
  );
  return { service, get, set, createQuote, recheckPrice, supplier, saveInventory, exec };
}

describe('opaque hotel rates', () => {
  afterEach(() => vi.useRealTimers());
  it('reuses validated unfiltered inventory for filter, sort and page changes without extending rates', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-12-01T00:00:00Z'));
    const { service, get, saveInventory, supplier, set } = setup();
    const inventory = new Map<string, string>();
    get.mockImplementation(async (key: string) => inventory.get(key) ?? null);
    saveInventory.mockImplementation(async (key: string, value: string) => {
      inventory.set(key, value);
      return 'OK';
    });
    const first = await service.searchHotels(criteria);
    vi.setSystemTime(new Date('2099-12-01T00:00:20Z'));
    const filtered = await service.searchHotels({
      ...criteria,
      filters: { name: 'Test' },
      sort: 'price-asc',
      page: 1,
      pageSize: 5,
    });
    expect(filtered.hotels).toEqual(first.hotels);
    expect(filtered.metadata).toMatchObject({ pageSize: 5, total: 1 });
    expect(supplier.searchHotels).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(1);
    expect(saveInventory).toHaveBeenCalledTimes(1);
    expect(saveInventory.mock.calls[0]?.slice(2)).toEqual(['EX', 30]);
    const absent = await service.searchHotels({ ...criteria, filters: { maxPrice: 1 } });
    expect(absent.hotels).toEqual([]);
    expect(absent.metadata?.facets.minPrice).toBe(12000);
    vi.setSystemTime(new Date('2099-12-01T00:00:31Z'));
    const fresh = await service.searchHotels(criteria);
    expect(supplier.searchHotels).toHaveBeenCalledTimes(2);
    expect(fresh.hotels[0]?.rates[0]?.rateId).not.toBe(first.hotels[0]?.rates[0]?.rateId);
  });

  it('does not share cached inventory across stay, occupancy, nationality or currency changes', async () => {
    const { service, get, saveInventory, supplier } = setup();
    const inventory = new Map<string, string>();
    get.mockImplementation(async (key: string) => inventory.get(key) ?? null);
    saveInventory.mockImplementation(async (key: string, value: string) => {
      inventory.set(key, value);
      return 'OK';
    });
    for (const input of [
      criteria,
      { ...criteria, checkOut: '2100-01-04' },
      { ...criteria, nationality: 'GB' },
      { ...criteria, currency: 'GBP' as const },
      { ...criteria, rooms: [{ adults: 3, childrenAges: [] }] },
    ])
      await service.searchHotels(input);
    expect(supplier.searchHotels).toHaveBeenCalledTimes(5);
    expect(inventory.size).toBe(5);
  });

  it('coalesces concurrent identical searches and removes failed pending work for a later retry', async () => {
    const { service, supplier } = setup();
    await Promise.all([
      service.searchHotels(criteria),
      service.searchHotels({ ...criteria, sort: 'stars' }),
    ]);
    expect(supplier.searchHotels).toHaveBeenCalledTimes(1);
    vi.mocked(supplier.searchHotels).mockRejectedValueOnce(new Error('supplier unavailable'));
    await expect(service.searchHotels(criteria)).rejects.toThrow('supplier unavailable');
    await expect(service.searchHotels(criteria)).resolves.toHaveProperty('hotels');
    expect(supplier.searchHotels).toHaveBeenCalledTimes(3);
  });

  it('refreshes malformed, stale or expired-reference cache entries', async () => {
    for (const raw of [
      '{',
      '{}',
      JSON.stringify({ expiresAt: '2000-01-01T00:00:00Z', hotels: [] }),
      JSON.stringify({
        expiresAt: '2200-01-01T00:00:00Z',
        hotels: [
          {
            hotel,
            rates: [
              {
                rateId: 'old',
                roomName: 'Double',
                refundable: false,
                price,
                expiresAt: '2000-01-01T00:00:00Z',
              },
            ],
          },
        ],
      }),
    ]) {
      const { service, get, supplier } = setup();
      get.mockResolvedValue(raw);
      const result = await service.searchHotels(criteria);
      expect(supplier.searchHotels).toHaveBeenCalledTimes(1);
      expect(result.hotels[0]?.rates[0]?.rateId).not.toBe('old');
    }
  });

  it('does not publish cached inventory if rate references failed to persist', async () => {
    const { service, exec, saveInventory } = setup();
    exec.mockResolvedValue([[new Error('cache unavailable'), null]]);
    await expect(service.searchHotels(criteria)).rejects.toMatchObject({
      code: 'SEARCH_UNAVAILABLE',
    });
    expect(saveInventory).not.toHaveBeenCalled();
  });

  it('normalizes cache read and inventory write failures', async () => {
    const read = setup();
    read.get.mockRejectedValue(new Error('redis private endpoint'));
    await expect(read.service.searchHotels(criteria)).rejects.toMatchObject({
      code: 'SEARCH_UNAVAILABLE',
    });
    expect(read.supplier.searchHotels).not.toHaveBeenCalled();
    const write = setup();
    write.saveInventory.mockRejectedValue(new Error('redis private endpoint'));
    await expect(write.service.searchHotels(criteria)).rejects.toMatchObject({
      code: 'SEARCH_UNAVAILABLE',
    });
  });

  it('keeps supplier tokens on the server and returns an opaque public reference', async () => {
    const { service, set } = setup();
    const response = await service.searchHotels(criteria);
    const publicRate = response.hotels[0]?.rates[0];
    expect(publicRate?.rateId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(response)).not.toContain('private-supplier-reference');
    expect(set.mock.calls[0]?.[1]).toContain('private-supplier-reference');
    expect(publicRate?.price.totalAmount).toBe(12000);
    expect(publicRate?.terms?.supplements).toEqual(rate.terms?.supplements);
    expect(JSON.parse(String(set.mock.calls[0]?.[1]))).toMatchObject({ roomNames: ['Double'] });
  });

  it('binds refreshed quotes to the authenticated user using stored criteria', async () => {
    const { service, get, createQuote } = setup();
    get.mockResolvedValue(
      JSON.stringify({
        supplier: 'TBO',
        hotel,
        criteria,
        supplierRateId: rate.supplierRateId,
        roomName: rate.roomName,
        roomNames: ['Double'],
        currency: 'USD',
        expiresAt: '2100-01-01T00:00:00.000Z',
      }),
    );
    const result = await service.recheckHotelRate('opaque-reference', 'authenticated-user-id');
    expect(createQuote).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'authenticated-user-id', criteria, hotel, rate }),
    );
    expect(result).not.toHaveProperty('supplierRateId');
    const publicQuote = quoteResponseSchema.parse(result);
    expect(publicQuote.terms).toEqual(rate.terms);
    expect(publicQuote.cancellationPolicies).toEqual([]);
    expect(publicQuote.refundable).toBe(false);
    expect(publicQuote.mealType).toBe('Room_Only');
    expect(JSON.stringify(publicQuote)).not.toContain(rate.supplierRateId);
    expect(createQuote).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: new Date('2100-01-01T00:00:00.000Z') }),
    );
  });

  it('rejects unavailable cache references before calling the supplier', async () => {
    const { service, get, recheckPrice } = setup();
    get.mockResolvedValue(null);
    await expect(service.recheckHotelRate('missing', 'user')).rejects.toMatchObject({
      code: 'RATE_EXPIRED',
    });
    expect(recheckPrice).not.toHaveBeenCalled();
  });

  it('rejects preview references before cache, supplier or quote work in live mode', async () => {
    const { service, get, recheckPrice, createQuote } = setup();
    await expect(service.recheckHotelRate('mock:preview-rate', 'user')).rejects.toMatchObject({
      code: 'MOCK_BOOKING_DISABLED',
    });
    expect(get).not.toHaveBeenCalled();
    expect(recheckPrice).not.toHaveBeenCalled();
    expect(createQuote).not.toHaveBeenCalled();
  });

  it('parses room arrays from a query and rejects browser-provided totals', () => {
    expect(
      hotelSearchQuerySchema.parse({ ...criteria, rooms: JSON.stringify(criteria.rooms) }),
    ).toEqual(criteria);
    expect(hotelSearchQuerySchema.safeParse({ ...criteria, totalAmount: 1 }).success).toBe(false);
  });

  it('rejects substituted hotel, currency or room combinations before persisting a quote', async () => {
    for (const replacement of [
      { ...rate, hotelId: '456' },
      { ...rate, price: { ...rate.price, currency: 'EUR' } },
      { ...rate, terms: { ...rate.terms!, roomNames: ['Other'] } },
      { ...rate, terms: { ...rate.terms!, roomNames: ['Double', 'Double'] } },
    ]) {
      const { service, get, createQuote, recheckPrice } = setup();
      get.mockResolvedValue(
        JSON.stringify({
          supplier: 'TBO',
          hotel,
          criteria,
          supplierRateId: rate.supplierRateId,
          roomName: rate.roomName,
          roomNames: ['Double'],
          currency: 'USD',
          expiresAt: '2100-01-01T00:00:00.000Z',
        }),
      );
      recheckPrice.mockResolvedValue(replacement);
      await expect(service.recheckHotelRate('opaque-reference', 'user')).rejects.toMatchObject({
        code: 'HOTEL_RATE_CHANGED',
      });
      expect(createQuote).not.toHaveBeenCalled();
    }
  });

  it('does not extend a cached rate that expires while PreBook is running', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-12-01T00:00:00Z'));
    const { service, get, createQuote, recheckPrice } = setup();
    get.mockResolvedValue(
      JSON.stringify({
        supplier: 'TBO',
        hotel,
        criteria,
        supplierRateId: rate.supplierRateId,
        roomName: rate.roomName,
        roomNames: ['Double'],
        currency: 'USD',
        expiresAt: '2099-12-01T00:00:01Z',
      }),
    );
    recheckPrice.mockImplementation(async () => {
      vi.setSystemTime(new Date('2099-12-01T00:00:02Z'));
      return rate;
    });
    await expect(service.recheckHotelRate('opaque-reference', 'user')).rejects.toMatchObject({
      code: 'RATE_EXPIRED',
    });
    expect(createQuote).not.toHaveBeenCalled();
  });
});
