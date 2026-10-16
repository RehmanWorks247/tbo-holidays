import { type BookingResponse, bookingResponseSchema } from '@hotel/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { BookingCheckout } from '@/features/checkout/components/booking-checkout';
import { pageMessages } from '@/lib/page-messages';
import { siteLocales } from '@/lib/site-locales';
import { type SiteLocale } from '@/lib/site-preferences';
import { SitePreferencesProvider } from '@/providers/site-preferences-provider';

import { BookingDetails } from './components/booking-details';

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ userId: 'test-user', getToken: vi.fn() }) }));
vi.mock('./queries/use-bookings', () => ({
  useBooking: () => ({ data: exampleBooking, isPending: false, error: null }),
  bookingKeys: { detail: vi.fn(), list: vi.fn() },
}));

const exampleBooking: BookingResponse = bookingResponseSchema.parse({
  id: '33a66555-0997-42c8-9087-08bcf0e5bd34',
  hotel: { id: 'test-hotel', name: 'Example Hotel', images: [], facilities: [] },
  checkIn: '2030-06-10',
  checkOut: '2030-06-12',
  rooms: [{ roomIndex: 0, name: 'Example room', adults: 1, childrenAges: [5] }],
  guests: [],
  price: {
    currency: 'EUR',
    baseAmount: 10000,
    taxAmount: 1500,
    feeAmount: 0,
    markupAmount: 0,
    discountAmount: 0,
    totalAmount: 11500,
  },
  bookingStatus: 'BOOKING_PENDING',
  paymentStatus: 'PAYMENT_PENDING',
  createdAt: '2030-01-01T00:00:00Z',
  updatedAt: '2030-01-01T00:00:00Z',
});

function renderPage(component: typeof BookingCheckout | typeof BookingDetails, locale: SiteLocale) {
  const Component = component;
  return renderToStaticMarkup(
    <SitePreferencesProvider initialLocale={locale}>
      <QueryClientProvider client={new QueryClient()}>
        <Component bookingId={exampleBooking.id} />
      </QueryClientProvider>
    </SitePreferencesProvider>,
  );
}

function escaped(text: string) {
  return renderToStaticMarkup(createElement('span', null, text)).slice(6, -7);
}

describe('booking pages use the selected language', () => {
  it.each(siteLocales.map(({ code }) => code))(
    '%s renders checkout and booking details without changing supplier data',
    (locale) => {
      const copy = pageMessages[locale].booking;
      const checkout = renderPage(BookingCheckout, locale);
      expect(checkout).toContain(escaped(copy.checkout.title));
      expect(checkout).toContain(escaped(copy.guests.contactEmail));
      expect(checkout).toContain(escaped(copy.guests.continue));
      expect(checkout).toContain('value="Mr"');
      expect(checkout).toContain('Example Hotel');
      const details = renderPage(BookingDetails, locale);
      expect(details).toContain(escaped(copy.statuses.BOOKING_PENDING));
      expect(details).toContain(escaped(copy.statuses.PAYMENT_PENDING));
      expect(details).toContain(escaped(copy.details.roomsAndGuests));
      expect(details).toContain('Example room');
      expect(details).toContain(
        `dir="${locale === 'ar-SA' || locale === 'he-IL' ? 'rtl' : 'ltr'}"`,
      );
      expect(exampleBooking.price).toMatchObject({ currency: 'EUR', totalAmount: 11500 });
    },
  );
});
