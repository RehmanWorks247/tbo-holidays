import type { SiteLocale } from './site-preferences';

// Stay dates are calendar dates, so formatting must not shift them with a time zone.
export function formatDate(value: string, locale: SiteLocale = 'en-US') {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    calendar: 'gregory',
  }).format(new Date(value));
}

export function formatDateTime(value: string, locale: SiteLocale = 'en-US') {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    calendar: 'gregory',
  }).format(new Date(value));
}
