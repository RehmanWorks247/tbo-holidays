import type { Hotel, HotelRate } from '@hotel/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SitePreferencesProvider } from '@/providers/site-preferences-provider';

import { HotelDetails } from './hotel-details';

const fixture = vi.hoisted(() => ({ source: 'mock' as 'mock' | 'live' }));
vi.mock('next/navigation', () => ({
  useSearchParams: () =>
    new URLSearchParams({
      destination: 'dubai',
      checkIn: '2030-06-10',
      checkOut: '2030-06-17',
      nationality: 'GB',
      currency: 'GBP',
      rooms: JSON.stringify([{ adults: 2, childrenAges: [] }]),
    }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { ...hotel, source: fixture.source }, isPending: false, error: null }),
}));
vi.mock('@/features/hotel-search/queries/use-hotel-search', () => ({
  useHotelSearch: () => ({
    data: { hotels: [{ hotel, rates: [rate] }] },
    isPending: false,
    error: null,
  }),
}));

const hotel: Hotel = {
  id: 'sample-1',
  name: 'Palm House',
  images: [],
  facilities: ['Swimming pool'],
};
const rate: HotelRate = {
  rateId: 'opaque-rate-id',
  roomName: 'Deluxe double',
  mealType: 'Breakfast included',
  refundable: true,
  expiresAt: '2030-06-01T00:00:00Z',
  price: {
    currency: 'GBP',
    baseAmount: 10000,
    taxAmount: 1000,
    feeAmount: 0,
    markupAmount: 0,
    discountAmount: 0,
    totalAmount: 11000,
  },
  cancellationPolicies: [
    {
      from: '2030-06-08T18:00:00',
      timeBasis: 'property-local',
      chargeType: 'percentage',
      percentageBasisPoints: 5000,
    },
  ],
  terms: {
    roomNames: ['Deluxe double'],
    amenities: ['Balcony'],
    promotions: [],
    rateConditions: ['Photo ID is required at arrival.'],
    supplements: [
      { payment: 'at-property', description: 'Tourism levy', currency: 'AED', amount: 2000 },
    ],
  },
};
const render = () =>
  renderToStaticMarkup(
    <SitePreferencesProvider initialLocale="en-GB">
      <HotelDetails hotelId={hotel.id} />
    </SitePreferencesProvider>,
  );

describe('hotel detail sample and live boundaries', () => {
  beforeEach(() => {
    fixture.source = 'mock';
  });
  it('shows sample inventory with disabled booking and preserves displayed backend charges', () => {
    const html = render();
    expect(html).toContain('Sample hotel');
    expect(html).toContain('Sample rate — booking unavailable');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('/checkout?');
    expect(html).toContain('£110.00');
    expect(html).toContain('Payable at the property:');
    expect(html).toContain('Tourism levy');
    expect(html).toContain('50% penalty');
    expect(html).toContain('property local time');
    expect(html).toContain('Photo ID is required at arrival.');
  });
  it('keeps the existing checkout action for live inventory', () => {
    fixture.source = 'live';
    const html = render();
    expect(html).toContain('/checkout?rateId=opaque-rate-id');
    expect(html).not.toContain('Sample rate — booking unavailable');
  });
});
