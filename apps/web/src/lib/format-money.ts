import type { PriceBreakdown } from '@hotel/contracts';

import type { SiteLocale } from './site-preferences';

// The API stores these supported currencies in hundredths. Locale/CLDR cash
// rounding rules (including PKR) must never determine the unit of stored money.
const minorUnitDigits: Record<PriceBreakdown['currency'], number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  AED: 2,
  PKR: 2,
  INR: 2,
};

export function formatMoney(
  price: Pick<PriceBreakdown, 'currency' | 'totalAmount'>,
  locale: SiteLocale = 'en-US',
) {
  const digits = minorUnitDigits[price.currency];
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: price.currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return formatter.format(price.totalAmount / 10 ** digits);
}
