import type { HotelSearchRequest, HotelSearchResult } from '@hotel/contracts';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { serializeHotelSearch } from '@/features/hotel-search/utils/search-params';
import { formatMoney } from '@/lib/format-money';

export function HotelCard({
  result,
  search,
}: {
  result: HotelSearchResult;
  search: HotelSearchRequest;
}) {
  const lowestRate = result.rates.reduce<HotelSearchResult['rates'][number] | undefined>(
    (lowest, rate) =>
      !lowest || rate.price.totalAmount < lowest.price.totalAmount ? rate : lowest,
    undefined,
  );
  return (
    <Card className="flex flex-col justify-between gap-5 sm:flex-row">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{result.hotel.name}</h2>
        <p className="text-sm text-muted-foreground">
          {[result.hotel.city, result.hotel.countryCode].filter(Boolean).join(', ') ||
            result.hotel.address}
        </p>
        {result.hotel.starRating ? (
          <p className="text-sm">{result.hotel.starRating}-star hotel</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {result.hotel.facilities.slice(0, 3).join(' · ')}
        </p>
      </div>
      <div className="space-y-3 sm:text-right">
        {lowestRate ? (
          <div>
            <p className="text-xs text-muted-foreground">Full stay from</p>
            <p className="text-xl font-semibold">{formatMoney(lowestRate.price)}</p>
          </div>
        ) : null}
        <Button asChild>
          <Link
            href={`/hotels/${encodeURIComponent(result.hotel.id)}?${serializeHotelSearch(search)}`}
          >
            View rooms
          </Link>
        </Button>
      </div>
    </Card>
  );
}
