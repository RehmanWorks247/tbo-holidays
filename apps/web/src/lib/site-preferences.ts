import { currencySchema, type HotelSearchRequest } from '@hotel/contracts';
import { z } from 'zod';

import { siteLocales } from './site-locales';

export type Currency = HotelSearchRequest['currency'];
export const siteLocaleSchema = z.enum(siteLocales.map(({ code }) => code));
export type SiteLocale = z.infer<typeof siteLocaleSchema>;

export const sitePreferencesSchema = z.object({
  currency: currencySchema,
  locale: siteLocaleSchema,
});
export type SitePreferences = z.infer<typeof sitePreferencesSchema>;

export const SITE_PREFERENCES_STORAGE_KEY = 'tbo-site-preferences';
export const SITE_LOCALE_COOKIE_NAME = 'tbo-locale';
export const DEFAULT_SITE_PREFERENCES: SitePreferences = { currency: 'USD', locale: 'en-US' };

export function parseStoredSitePreferences(value: string | null): {
  preferences: SitePreferences;
  storageError: string | null;
} {
  if (value === null) return { preferences: DEFAULT_SITE_PREFERENCES, storageError: null };

  try {
    const data: unknown = JSON.parse(value);
    const result = sitePreferencesSchema.safeParse(data);
    if (result.success) return { preferences: result.data, storageError: null };
  } catch {
    // Malformed browser data is handled by the same visible recovery state as invalid values.
  }

  return {
    preferences: DEFAULT_SITE_PREFERENCES,
    storageError: 'Your saved preferences could not be read. Please choose them again.',
  };
}

export function replaceCurrencyInUrl(
  url: string,
  currency: Currency,
  fallbackCurrency: Currency = 'USD',
): string {
  const hashIndex = url.indexOf('#');
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf('?');
  const path = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const params = new URLSearchParams(queryIndex === -1 ? '' : withoutHash.slice(queryIndex + 1));
  if ((params.get('currency') ?? fallbackCurrency) !== currency) {
    params.delete('page');
    const search = parseSearchFilters(params.get('filters'));
    if (search) {
      delete search.minPrice;
      delete search.maxPrice;
      if (Object.keys(search).length) params.set('filters', JSON.stringify(search));
      else params.delete('filters');
    }
  }
  params.set('currency', currencySchema.parse(currency));
  return `${path}?${params.toString()}${hash}`;
}

function parseSearchFilters(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? { ...value }
      : undefined;
  } catch {
    // Preserve malformed input so normal search validation can explain it.
    return undefined;
  }
}
