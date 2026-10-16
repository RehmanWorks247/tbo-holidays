import { currencySchema } from '@hotel/contracts';
import { describe, expect, it } from 'vitest';

import { formatDate, formatDateTime } from './format-date';
import { formatMoney } from './format-money';
import { pageEnglish } from './page-english';
import { interpolateMessage, pageMessages } from './page-messages';
import { requestErrorMessageKey } from './request-error-message';
import { siteLocales } from './site-locales';

function leaves(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  if (!value || typeof value !== 'object') throw new Error(`Invalid message at ${prefix}`);
  return Object.assign(
    {},
    ...Object.entries(value).map(([key, item]) => leaves(item, prefix ? `${prefix}.${key}` : key)),
  );
}

const source = leaves(pageEnglish);
describe('complete website translations', () => {
  it.each(siteLocales.map(({ code }) => code))(
    '%s covers every page and preserves interpolation variables',
    (locale) => {
      const translated = leaves(pageMessages[locale]);
      expect(Object.keys(translated).sort()).toEqual(Object.keys(source).sort());
      for (const [key, original] of Object.entries(source)) {
        expect(translated[key]?.trim(), `${locale}: ${key}`).toBeTruthy();
        const variables = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
        expect(variables(translated[key]!), `${locale}: ${key}`).toEqual(variables(original));
      }
      if (!locale.startsWith('en-')) {
        for (const key of [
          'home.hero.title',
          'booking.checkout.title',
          'app.bookingsTitle',
          'results.viewRooms',
        ]) {
          expect(translated[key], `${locale}: English fallback at ${key}`).not.toBe(source[key]);
        }
      }
    },
  );

  it('interpolates numeric counts locally and treats supplied strings as literal data', () => {
    expect(
      interpolateMessage('{name}: {count}', { name: 'A $& {count}', count: 1234 }, 'de-DE'),
    ).toBe('A $& {count}: 1.234');
    expect(interpolateMessage('{count}', { count: 12 }, 'ar-SA')).toBe(
      new Intl.NumberFormat('ar-SA').format(12),
    );
  });
});

describe('localized booking formatting', () => {
  it('keeps the authoritative minor-unit amount and currency in every locale', () => {
    for (const { code } of siteLocales) {
      for (const currency of currencySchema.options) {
        const price = { currency, totalAmount: 123456 };
        expect(formatMoney(price, code)).toBe(
          new Intl.NumberFormat(code, {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(1234.56),
        );
        expect(price.totalAmount).toBe(123456);
        expect(price.currency).toBe(currency);
      }
    }
  });

  it('keeps stay dates Gregorian and on the original calendar day', () => {
    expect(formatDate('2030-06-10', 'en-GB')).toBe('10 Jun 2030');
    for (const { code } of siteLocales) {
      const expected = new Intl.DateTimeFormat(code, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        calendar: 'gregory',
        timeZone: 'UTC',
      }).format(new Date('2030-06-10T12:00:00Z'));
      expect(formatDate('2030-06-10', code)).toBe(expected);
      expect(() => formatDateTime('2030-06-10T12:00:00Z', code)).not.toThrow();
    }
  });
});

describe('translated request failures', () => {
  it('retains the distinction between unknown outcomes, pending confirmation and definite failure', () => {
    expect(requestErrorMessageKey('PAYMENT_RECONCILIATION_REQUIRED', 503)).toBe('paymentReview');
    expect(requestErrorMessageKey('SUPPLIER_BOOKING_PENDING', 503)).toBe('confirmationPending');
    expect(requestErrorMessageKey('PAYMENT_NOT_CONFIGURED', 503)).toBe('paymentsUnavailable');
    expect(requestErrorMessageKey('API_UNAVAILABLE', 503)).toBe('requestError');
    expect(requestErrorMessageKey('UNRECOGNIZED_CODE', 503)).toBe('requestError');
    expect(requestErrorMessageKey('toString', 503)).toBe('requestError');
  });
});
