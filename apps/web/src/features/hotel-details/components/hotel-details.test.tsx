import type { Hotel, HotelPreviewStay, HotelRate, MockHotelSearchRequest } from '@hotel/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SitePreferencesProvider } from '@/providers/site-preferences-provider';

import { HotelDetails } from './hotel-details';

const fixture = vi.hoisted(() => ({
  source: 'mock' as 'mock' | 'live',
  query: '',
  previewStay: undefined as HotelPreviewStay | undefined,
  requests: [] as (MockHotelSearchRequest | null)[],
  detailsPending: false,
  formSearch: undefined as MockHotelSearchRequest | undefined,
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(fixture.query),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: fixture.detailsPending ? undefined : { ...hotel, source: fixture.source },
    isPending: fixture.detailsPending,
    error: null,
  }),
}));
vi.mock('@/features/hotel-search/queries/use-hotel-search', () => ({
  useHotelSearch: (request: MockHotelSearchRequest | null) => {
    fixture.requests.push(request);
    return {
      data: request
        ? {
            hotels: [{ hotel, rates: [rate] }],
            metadata: { source: fixture.source, previewStay: fixture.previewStay },
          }
        : undefined,
      isPending: !request,
      error: null,
    };
  },
}));
vi.mock('@/features/hotel-search/components/hotel-search-form', () => ({
  HotelSearchForm: ({ initialSearch }: { initialSearch: MockHotelSearchRequest }) => {
    fixture.formSearch = initialSearch;
    return <form aria-label="Check this hotel's availability" />;
  },
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
    fixture.query = new URLSearchParams({
      destination: 'dubai',
      checkIn: '2030-06-10',
      checkOut: '2030-06-17',
      nationality: 'GB',
      currency: 'GBP',
      rooms: JSON.stringify([{ adults: 2, childrenAges: [] }]),
    }).toString();
    fixture.previewStay = undefined;
    fixture.requests = [];
    fixture.detailsPending = false;
    fixture.formSearch = undefined;
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

  it('uses the backend sample stay and preserves browse filters in its Back link', () => {
    fixture.query = new URLSearchParams({
      currency: 'GBP',
      filters: JSON.stringify({ starRatings: [5], refundable: true }),
      sort: 'rating',
      page: '3',
    }).toString();
    fixture.previewStay = {
      checkIn: '2030-07-01',
      checkOut: '2030-07-08',
      nationality: 'GB',
      rooms: [{ adults: 3, childrenAges: [8] }],
      currency: 'GBP',
    };
    const html = render();
    const request = fixture.requests.at(-1);
    expect(request?.filters).toEqual({ name: hotel.name });
    expect(request?.page).toBe(1);
    expect(request?.pageSize).toBe(50);
    expect(request?.destination).toBeUndefined();
    expect(request?.checkIn).toBeUndefined();
    expect(request?.rooms).toBeUndefined();
    expect(html).toContain('Sample stay</h2>');
    expect(html).toContain('1 Jul 2030');
    expect(html).toContain('8 Jul 2030');
    expect(html).toContain('4 guests');
    expect(html).toContain('Sample rooms &amp; rates');
    expect(html).toContain(`href="/hotels?${fixture.query.replaceAll('&', '&amp;')}"`);
    expect(html).not.toContain('checkIn=');
    expect(html).not.toContain('/checkout?');
  });

  it('leaves a direct mock hotel link empty and requests sample rates after confirmation', () => {
    fixture.query = '';
    const html = render();
    expect(fixture.requests.at(-1)).toMatchObject({
      currency: 'USD',
      filters: { name: hotel.name },
    });
    expect(html).toContain('href="/hotels"');
    expect(html).not.toContain('Invalid Date');
    expect(html).not.toContain('NaN');
    expect(html).toContain('Sample rate — booking unavailable');
  });

  it('does not search partial criteria before mock inventory is confirmed', () => {
    fixture.query = 'currency=GBP&checkIn=2030-07-01';
    fixture.detailsPending = true;
    render();
    expect(fixture.requests.at(-1)).toBeNull();
  });

  it('offers a date and guest search for the exact hotel without inventing rates', () => {
    fixture.source = 'live';
    fixture.query = 'currency=GBP';
    const html = render();
    expect(fixture.requests.at(-1)).toBeNull();
    expect(html).not.toContain('/checkout?');
    expect(html).not.toContain('Sample stay');
    expect(html).toContain('Check this hotel&#x27;s availability');
    expect(fixture.formSearch?.hotelId).toBe(hotel.id);
    expect(fixture.formSearch?.checkIn).toBeUndefined();
  });
});
