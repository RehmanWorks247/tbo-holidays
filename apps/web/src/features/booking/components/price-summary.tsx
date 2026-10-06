import type { PriceBreakdown } from '@hotel/contracts';

import { formatMoney } from '@/lib/format-money';

export function PriceSummary({ price }: { price: PriceBreakdown }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Total for your stay, including applicable taxes and fees
      </p>
      <p className="text-2xl font-semibold">{formatMoney(price)}</p>
      <p className="text-xs text-muted-foreground">
        The booking service calculates and confirms this total.
      </p>
    </div>
  );
}
