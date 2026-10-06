import type { HotelSearchRequest } from '@hotel/contracts';
import { describe, expect, it } from 'vitest';

import { parseHotelSearch, serializeHotelSearch } from './search-params';

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
});
