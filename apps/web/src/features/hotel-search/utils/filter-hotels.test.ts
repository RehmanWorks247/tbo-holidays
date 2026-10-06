import type { HotelSearchResult } from '@hotel/contracts';
import { describe, expect, it } from 'vitest';

import { filterHotels } from './filter-hotels';

const result: HotelSearchResult = {
  hotel: {
    id: 'test-hotel',
    name: 'Contract test hotel',
    starRating: 4,
    images: [],
    facilities: ['WiFi'],
  },
  rates: [
    {
      rateId: 'rate-1',
      roomName: 'Room',
      refundable: true,
      expiresAt: '2030-01-01T00:00:00Z',
      price: {
        currency: 'USD',
        baseAmount: 18000,
        taxAmount: 2000,
        feeAmount: 0,
        markupAmount: 0,
        discountAmount: 0,
        totalAmount: 20000,
      },
    },
    {
      rateId: 'rate-2',
      roomName: 'Room',
      refundable: false,
      expiresAt: '2030-01-01T00:00:00Z',
      price: {
        currency: 'USD',
        baseAmount: 9000,
        taxAmount: 1000,
        feeAmount: 0,
        markupAmount: 0,
        discountAmount: 0,
        totalAmount: 10000,
      },
    },
  ],
};

describe('display filters', () => {
  it('requires one rate to satisfy all selected rate conditions', () => {
    expect(filterHotels([result], { refundable: true, maxPrice: 15000 })).toEqual([]);
    expect(filterHotels([result], { refundable: true, maxPrice: 25000 })).toEqual([result]);
  });
  it('supports case-insensitive names and facility extension', () => {
    expect(filterHotels([result], { name: 'CONTRACT', facilities: ['WiFi'] })).toEqual([result]);
    expect(filterHotels([result], { facilities: ['Pool'] })).toEqual([]);
  });
});
