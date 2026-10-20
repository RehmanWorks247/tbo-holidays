import { describe, expect, it } from 'vitest';

import { siteLocales } from './site-locales';
import {
  DEFAULT_SITE_PREFERENCES,
  parseStoredSitePreferences,
  replaceCurrencyInUrl,
} from './site-preferences';

describe('site preferences', () => {
  it('restores validated currency and language preferences', () => {
    expect(parseStoredSitePreferences('{"currency":"PKR","locale":"ar-SA"}')).toEqual({
      preferences: { currency: 'PKR', locale: 'ar-SA' },
      storageError: null,
    });
    expect(parseStoredSitePreferences(null)).toEqual({
      preferences: DEFAULT_SITE_PREFERENCES,
      storageError: null,
    });
  });

  it('restores every selectable language including regional and script variants', () => {
    for (const { code } of siteLocales) {
      const result = parseStoredSitePreferences(JSON.stringify({ currency: 'EUR', locale: code }));
      expect(result.preferences.locale).toBe(code);
      expect(result.storageError).toBeNull();
    }
  });

  it.each([
    'not-json',
    'null',
    '{"currency":"JPY","locale":"en-US"}',
    '{"currency":"USD","locale":"invalid"}',
    '{"currency":"EUR"}',
  ])('recovers unsupported or malformed browser preferences: %s', (value) => {
    const result = parseStoredSitePreferences(value);
    expect(result.preferences).toEqual(DEFAULT_SITE_PREFERENCES);
    expect(result.storageError).toBeTruthy();
  });

  it('changes the search currency without losing stay, guest, repeated, or hash parameters', () => {
    const original = new URL('https://example.com/hotels/123');
    original.search = new URLSearchParams({
      destination: '456',
      checkIn: '2030-06-10',
      checkOut: '2030-06-12',
      nationality: 'PK',
      currency: 'USD',
      rooms: JSON.stringify([{ adults: 2, childrenAges: [0, 12] }]),
    }).toString();
    original.searchParams.append('filter', 'pool');
    original.searchParams.append('filter', 'spa');
    original.hash = '#rooms';
    const updated = new URL(replaceCurrencyInUrl(original.toString(), 'EUR'));
    expect(updated.searchParams.get('currency')).toBe('EUR');
    original.searchParams.delete('currency');
    updated.searchParams.delete('currency');
    expect(updated.toString()).toBe(original.toString());
    expect(replaceCurrencyInUrl('/hotels#rooms', 'AED')).toBe('/hotels?currency=AED#rooms');
  });

  it('clears currency-specific budgets and pagination without dropping other hotel filters', () => {
    const filters = {
      minPrice: 10000,
      maxPrice: 80000,
      starRatings: [4, 5],
      facilities: ['Spa'],
      refundable: true,
    };
    const original = new URL('https://example.com/hotels');
    original.search = new URLSearchParams({
      currency: 'USD',
      filters: JSON.stringify(filters),
      page: '3',
      sort: 'price-asc',
      destination: 'dubai',
    }).toString();
    const next = new URL(replaceCurrencyInUrl(original.toString(), 'PKR'));
    expect(next.searchParams.get('currency')).toBe('PKR');
    expect(JSON.parse(next.searchParams.get('filters') ?? '{}')).toEqual({
      starRatings: [4, 5],
      facilities: ['Spa'],
      refundable: true,
    });
    expect(next.searchParams.has('page')).toBe(false);
    expect(next.searchParams.get('sort')).toBe('price-asc');
    expect(next.searchParams.get('destination')).toBe('dubai');
    expect(filters).toHaveProperty('maxPrice', 80000);
  });

  it('uses the effective saved currency when an all-hotels URL omits its currency', () => {
    const original = new URL('https://example.com/hotels');
    original.search = new URLSearchParams({
      filters: JSON.stringify({ maxPrice: 10000, starRatings: [3] }),
      page: '2',
      sort: 'price-asc',
    }).toString();
    const changed = new URL(replaceCurrencyInUrl(original.toString(), 'USD', 'GBP'));
    expect(changed.searchParams.get('currency')).toBe('USD');
    expect(changed.searchParams.has('page')).toBe(false);
    expect(JSON.parse(changed.searchParams.get('filters') ?? '{}')).toEqual({ starRatings: [3] });
    expect(changed.searchParams.get('sort')).toBe('price-asc');
    expect(changed.searchParams.has('destination')).toBe(false);

    const unchanged = new URL(replaceCurrencyInUrl(original.toString(), 'GBP', 'GBP'));
    expect(unchanged.searchParams.get('page')).toBe('2');
    expect(JSON.parse(unchanged.searchParams.get('filters') ?? '{}')).toEqual({
      maxPrice: 10000,
      starRatings: [3],
    });
  });
});
