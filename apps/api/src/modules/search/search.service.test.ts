import type { HotelSearchRequest } from '@hotel/contracts';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

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
  refundable: false,
  price: { currency: 'USD', baseAmount: 10000, taxAmount: 1000, feeAmount: 0 },
  cancellationPolicies: [],
};
const price = { ...rate.price, markupAmount: 1000, discountAmount: 0, totalAmount: 12000 };

function setup() {
  const set = vi.fn();
  const get = vi.fn();
  const exec = vi.fn().mockResolvedValue([[null, 'OK']]);
  const redis = { client: { get, pipeline: () => ({ set, exec }) } } as unknown as RedisService;
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
  return { service, get, set, createQuote, recheckPrice };
}

describe('opaque hotel rates', () => {
  it('keeps supplier tokens on the server and returns an opaque public reference', async () => {
    const { service, set } = setup();
    const response = await service.searchHotels(criteria);
    const publicRate = response.hotels[0]?.rates[0];
    expect(publicRate?.rateId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(response)).not.toContain('private-supplier-reference');
    expect(set.mock.calls[0]?.[1]).toContain('private-supplier-reference');
    expect(publicRate?.price.totalAmount).toBe(12000);
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
        currency: 'USD',
        expiresAt: '2100-01-01T00:00:00.000Z',
      }),
    );
    const result = await service.recheckHotelRate('opaque-reference', 'authenticated-user-id');
    expect(createQuote).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'authenticated-user-id', criteria, hotel, rate }),
    );
    expect(result).not.toHaveProperty('supplierRateId');
  });

  it('rejects unavailable cache references before calling the supplier', async () => {
    const { service, get, recheckPrice } = setup();
    get.mockResolvedValue(null);
    await expect(service.recheckHotelRate('missing', 'user')).rejects.toMatchObject({
      code: 'RATE_EXPIRED',
    });
    expect(recheckPrice).not.toHaveBeenCalled();
  });

  it('parses room arrays from a query and rejects browser-provided totals', () => {
    expect(
      hotelSearchQuerySchema.parse({ ...criteria, rooms: JSON.stringify(criteria.rooms) }),
    ).toEqual(criteria);
    expect(hotelSearchQuerySchema.safeParse({ ...criteria, totalAmount: 1 }).success).toBe(false);
  });
});
