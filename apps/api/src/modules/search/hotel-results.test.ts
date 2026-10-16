import type { HotelRate, HotelSearchRequest, HotelSearchResult } from '@hotel/contracts';
import { describe, expect, it } from 'vitest';

import { browseHotelResults } from './hotel-results';

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
