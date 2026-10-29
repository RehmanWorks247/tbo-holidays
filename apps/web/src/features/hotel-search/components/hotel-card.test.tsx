import type { HotelPreviewStay, HotelSearchResult, MockHotelSearchRequest } from '@hotel/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SitePreferencesProvider } from '@/providers/site-preferences-provider';

import { HotelCard } from './hotel-card';

const result: HotelSearchResult = {
  hotel: { id: 'sample-1', name: 'Palm House', images: [], facilities: [], source: 'mock' },
  rates: [
    {
      rateId: 'sample-rate',
      roomName: 'Deluxe double',
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
    },
  ],
};
const previewStay: HotelPreviewStay = {
  checkIn: '2030-07-01',
  checkOut: '2030-07-08',
  nationality: 'GB',
  currency: 'GBP',
  rooms: [{ adults: 3, childrenAges: [8] }],
};
const render = (search: MockHotelSearchRequest, preview?: HotelPreviewStay, inventory = result) =>
  renderToStaticMarkup(
    <SitePreferencesProvider initialLocale="en-GB">
      <HotelCard result={inventory} search={search} previewStay={preview} />
    </SitePreferencesProvider>,
  );

describe('hotel card sample stays', () => {
  it('shows real catalogue content without implying a rate or available room exists', () => {
    const html = render({ destination: 'Turkey', currency: 'GBP' }, undefined, {
      ...result,
      hotel: { ...result.hotel, source: 'live' },
      rates: [],
    });
    expect(html).toContain('Palm House');
    expect(html).toContain('View hotel');
    expect(html).toContain('Choose dates and guests to check availability and prices');
    expect(html).not.toContain('Price confirmed at recheck');
    expect(html).not.toContain('110.00');
    expect(html).not.toContain('Sample');
  });
  it('shows backend sample dates and guests without adding them to the details URL', () => {
    const html = render({ currency: 'GBP', filters: { starRatings: [5] } }, previewStay);
    expect(html).toContain('Sample stay: 1 Jul 2030');
    expect(html).toContain('7 nights');
    expect(html).toContain('Sample: 4 guests');
    expect(html).toContain('Sample stay from');
    expect(html).toContain('£110.00');
    expect(html).toContain('filters=');
    expect(html).not.toContain('destination=');
    expect(html).not.toContain('checkIn=');
    expect(html).not.toContain('rooms=');
  });

  it('does not invent dates or guests while sample stay metadata is absent', () => {
    const html = render({ currency: 'GBP' });
    expect(html).toContain('£110.00');
    expect(html).not.toContain('Invalid Date');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('7 nights');
    expect(html).not.toContain('4 guests');
  });

  it('uses full live search context and ignores sample metadata for live hotels', () => {
    const html = render(
      {
        destination: 'dubai',
        checkIn: '2030-06-10',
        checkOut: '2030-06-12',
        nationality: 'GB',
        currency: 'GBP',
        rooms: [{ adults: 2, childrenAges: [] }],
      },
      previewStay,
      { ...result, hotel: { ...result.hotel, source: 'live' } },
    );
    expect(html).toContain('10 Jun 2030');
    expect(html).toContain('2 nights');
    expect(html).toContain('2 guests');
    expect(html).not.toContain('Sample stay');
    expect(html).not.toContain('1 Jul 2030');
  });
});
