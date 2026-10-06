import type { PriceBreakdown } from '@hotel/contracts';

export function formatMoney(price: Pick<PriceBreakdown, 'currency' | 'totalAmount'>) {
  const formatter = new Intl.NumberFormat('en', { style: 'currency', currency: price.currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(price.totalAmount / 10 ** digits);
}
