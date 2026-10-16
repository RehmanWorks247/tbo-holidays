'use client';

import type { PriceBreakdown } from '@hotel/contracts';

import { formatMoney } from '@/lib/format-money';
import { usePageMessages } from '@/providers/use-page-messages';

export function PriceSummary({ price }: { price: PriceBreakdown }) {
  const {
    messages: { booking: copy },
    locale,
    dir,
  } = usePageMessages();
  return (
    <div className="space-y-2" lang={locale} dir={dir}>
      <p className="text-sm text-muted-foreground">{copy.price.totalDescription}</p>
      <p className="text-2xl font-semibold">{formatMoney(price, locale)}</p>
      <p className="text-xs text-muted-foreground">{copy.price.confirmation}</p>
    </div>
  );
}
